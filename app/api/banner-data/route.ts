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

    // Determine phase: mystery (before release) | before ticketing | event countdown
    // LOCAL_EVENTS_ENABLED=true means all events are treated as released (never mystery)
    const now = new Date();
    let isMystery: boolean;
    if (process.env.LOCAL_EVENTS_ENABLED === "true") {
      isMystery = false;
    } else if (!closestEvent?.release_date) {
      isMystery = !closestEvent?.name;
    } else {
      const releaseDate = new Date(closestEvent.release_date);
      isMystery = now < releaseDate;
    }

    const ticketingDate = closestEvent?.ticketing_date
      ? new Date(closestEvent.ticketing_date)
      : null;
    const isBeforeTicketing =
      process.env.LOCAL_TICKETING_ENABLED !== "true" &&
      !isMystery &&
      ticketingDate &&
      !Number.isNaN(ticketingDate.getTime()) &&
      now < ticketingDate;

    // Show banner if there's an upcoming event
    const showBanner = !!closestEvent;

    // Banner text and countdown target: reveal → tickets release → event
    const bannerText = isMystery
      ? BANNER_MESSAGES.NOTIFY_MESSAGE
      : closestEvent?.name + (closestEvent?.name?.includes("and") ? BANNER_MESSAGES.EVENT_MESSAGE_PLURAL : BANNER_MESSAGES.EVENT_MESSAGE);

    const countdownTarget = isMystery
      ? closestEvent?.release_date
      : isBeforeTicketing
        ? closestEvent?.ticketing_date ?? undefined
        : closestEvent?.doors_open;
    const prefaceLabel = isMystery
      ? BANNER_MESSAGES.COUNTDOWN_REVEAL_MESSAGE
      : isBeforeTicketing
        ? BANNER_MESSAGES.COUNTDOWN_TICKETS_MESSAGE
        : BANNER_MESSAGES.COUNTDOWN_EVENT_MESSAGE;

    const bannerHref = isMystery
      ? "/upcoming-speakers"
      : closestEvent
        ? `/events/${closestEvent.route}`
        : "/upcoming-speakers";

    return NextResponse.json({
      showBanner,
      bannerProps: {
        text: bannerText,
        href: bannerHref,
        prefaceLabel,
        target: countdownTarget || null,
      },
    });
  } catch {
    return NextResponse.json({ showBanner: false, bannerProps: null });
  }
}
