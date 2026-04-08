import { NextRequest, NextResponse } from "next/server";
import {
  getEventById,
  getSupabaseClient,
  isEventMystery,
} from "@/app/lib/supabase";
import { fetchWithTimeout, isFetchTimeoutError } from "@/app/lib/fetch";
import { checkRateLimit, imageRatelimit } from "@/app/lib/ratelimit";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Cache headers for successful responses
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "CDN-Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
};
const IMAGE_ORIGIN_FETCH_TIMEOUT_MS = 10_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  // Get version from query param for cache key
  const url = new URL(request.url);
  const requestedVersion = url.searchParams.get("v") || "1";
  const requestedVariant = url.searchParams.get("variant") === "mobile"
    ? "mobile"
    : "default";

  // R2 cache key: images/{eventId}/{variant}/v{version}
  const r2Key = `images/${eventId}/${requestedVariant}/v${requestedVersion}`;

  // Get R2 bucket from Cloudflare context
  const { env } = getCloudflareContext();
  const bucket = env.ssb_cache;

  // Try to get from R2 cache first
  if (bucket) {
    try {
      const cached = await bucket.get(r2Key);
      if (cached) {
        const contentType = cached.httpMetadata?.contentType || "image/jpeg";
        return new Response(cached.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            ...CACHE_HEADERS,
            ETag: `"${eventId}-${requestedVariant}-v${requestedVersion}"`,
            "X-Cache": "HIT",
            "X-Cache-Source": "R2",
          },
        });
      }
    } catch (error) {
      // Log but continue to fetch from origin on R2 errors
      console.error("R2 cache read error:", error);
    }
  }

  // Cache miss - proceed with rate limiting and fetch

  // Rate limiting by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
  const rateLimitResponse = await checkRateLimit(imageRatelimit, ip);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Get event from database
  const event = await getEventById(eventId);
  const imageName = requestedVariant === "mobile"
    ? event?.mobile_img || event?.img
    : event?.img || event?.mobile_img;

  if (!event || !imageName) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Check if mystery - return 404
  if (isEventMystery(event)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Generate signed URL (short expiry - we fetch immediately)
  const supabase = getSupabaseClient();
  const { data: signedData, error: signedError } = await supabase.storage
    .from("speakers")
    .createSignedUrl(imageName, 60);

  if (signedError || !signedData?.signedUrl) {
    return new NextResponse("Image not found", { status: 404 });
  }

  // Fetch image from Supabase
  let imageResponse: Response;
  try {
    imageResponse = await fetchWithTimeout(
      signedData.signedUrl,
      {},
      IMAGE_ORIGIN_FETCH_TIMEOUT_MS,
    );
  } catch (error) {
    if (isFetchTimeoutError(error)) {
      return new NextResponse("Image origin timed out", { status: 504 });
    }

    throw error;
  }

  if (!imageResponse.ok) {
    return new NextResponse("Image not found", { status: 404 });
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const contentType = imageResponse.headers.get("Content-Type") || "image/jpeg";

  // Store in R2 cache for future requests (non-blocking)
  if (bucket) {
    try {
      await bucket.put(r2Key, imageBuffer, {
        httpMetadata: {
          contentType,
        },
      });
    } catch (error) {
      // Log but don't fail the request on R2 write errors
      console.error("R2 cache write error:", error);
    }
  }

  // Build response with cache headers
  return new NextResponse(imageBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ...CACHE_HEADERS,
      ETag: `"${eventId}-${requestedVariant}-v${requestedVersion}"`,
      "X-Cache": "MISS",
      "X-Cache-Source": "R2",
    },
  });
}
