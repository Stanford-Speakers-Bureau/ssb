import { NextRequest, NextResponse } from "next/server";
import {
  getEventById,
  getSupabaseClient,
  isEventMystery,
} from "@/app/lib/supabase";
import { checkRateLimit, imageRatelimit } from "@/app/lib/ratelimit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

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

  // Get version from query param for cache key
  const url = new URL(request.url);
  const requestedVersion = url.searchParams.get("v");
  const currentVersion = event.img_version?.toString() || "1";

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

  // Return with aggressive cache headers
  return new NextResponse(imageBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${eventId}-v${requestedVersion || currentVersion}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
