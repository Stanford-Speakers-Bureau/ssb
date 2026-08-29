import { NextResponse } from "next/server";
import { checkRateLimit, bannerRatelimit } from "@/app/lib/ratelimit";
import { getBannerData } from "@/app/lib/banner";

export async function GET(req: Request) {
  // Rate limit by IP address
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitResponse = await checkRateLimit(
    bannerRatelimit,
    `banner:${ip}`,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const url = new URL(req.url);
  const fresh = url.searchParams.get("fresh") === "1";

  const data = await getBannerData({ fresh, includeAuth: true });
  return NextResponse.json(data);
}
