import { NextResponse } from "next/server";
import { getClosestUpcomingEvent } from "../../lib/supabase";
import { BANNER_MESSAGES } from "@/app/lib/constants";
import { checkRateLimit, bannerRatelimit } from "@/app/lib/ratelimit";

export async function GET(req: Request) {
  // Rate limit by IP address
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitResponse = await checkRateLimit(
    bannerRatelimit,
    `banner:${ip}`,
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const closestEvent = await getClosestUpcomingEvent();

    // Determine if speaker is still a mystery (before release_date)
    const now = new Date();
    let isMystery: boolean;
    if (!closestEvent?.release_date) {
      isMystery = !closestEvent?.name;
    } else {
      const releaseDate = new Date(closestEvent.release_date);
      isMystery = now < releaseDate;
    }

    // Show banner if there's an upcoming event
    const showBanner = !!closestEvent;

    // Banner text and countdown target based on mystery status
    const bannerText = isMystery
      ? BANNER_MESSAGES.NOTIFY_MESSAGE
      : closestEvent?.name + BANNER_MESSAGES.EVENT_MESSAGE;
    const countdownTarget = isMystery
      ? closestEvent?.release_date
      : closestEvent?.doors_open;
    const prefaceLabel = isMystery
      ? BANNER_MESSAGES.COUNTDOWN_REVEAL_MESSAGE
      : BANNER_MESSAGES.COUNTDOWN_EVENT_MESSAGE;

    return NextResponse.json({
      showBanner,
      bannerProps: {
        text: bannerText,
        href: "/upcoming-speakers",
        prefaceLabel,
        target: countdownTarget || null,
      },
    });
  } catch {
    return NextResponse.json({ showBanner: false, bannerProps: null });
  }
}
