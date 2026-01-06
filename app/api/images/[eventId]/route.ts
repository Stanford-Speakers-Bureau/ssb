import { NextRequest, NextResponse } from "next/server";
import {
  getEventById,
  getSupabaseClient,
  isEventMystery,
} from "@/app/lib/supabase";
import { checkRateLimit, imageRatelimit } from "@/app/lib/ratelimit";

// Cache headers for successful responses
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "CDN-Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  // Get version from query param for cache key
  const url = new URL(request.url);
  const requestedVersion = url.searchParams.get("v") || "1";

  // Create a cache key based on the full URL (includes ?v= param)
  const cacheKey = new Request(url.toString(), {
    method: "GET",
  });

  // Try to get from Cloudflare edge cache first
  // @ts-expect-error - caches.default is available in Cloudflare Workers runtime
  const cache = caches.default;
  if (cache) {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      // Clone and add header to indicate cache hit
      const response = new Response(cachedResponse.body, cachedResponse);
      response.headers.set("X-Cache", "HIT");
      return response;
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
  if (!event || !event.img) {
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
    .createSignedUrl(event.img, 60);

  if (signedError || !signedData?.signedUrl) {
    return new NextResponse("Image not found", { status: 404 });
  }

  // Fetch image from Supabase
  const imageResponse = await fetch(signedData.signedUrl);
  if (!imageResponse.ok) {
    return new NextResponse("Image not found", { status: 404 });
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const contentType = imageResponse.headers.get("Content-Type") || "image/jpeg";

  // Build response with cache headers
  const response = new NextResponse(imageBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ...CACHE_HEADERS,
      ETag: `"${eventId}-v${requestedVersion}"`,
      "X-Cache": "MISS",
    },
  });

  // Store in Cloudflare edge cache for future requests
  if (cache) {
    // Clone the response before caching (response body can only be read once)
    await cache.put(cacheKey, response.clone());
  }

  return response;
}
