import { getNextMilestoneEvent, getImageProxyUrl } from "./supabase";
import { BANNER_MESSAGES } from "./constants";
import { getSessionUser } from "./auth";
import { db, eq, and, notify } from "@ssb/db";

export type BannerProps = {
  text: string;
  href: string;
  target: string | null;
  prefaceLabel: string;
  eventId: string | null;
  imageUrl: string | null;
  phase: "mystery" | "pre-ticketing" | "ticketing-open";
  eventRoute: string | null;
  speakerName: string | null;
  isLoggedIn: boolean;
  isNotified: boolean;
};

export type BannerData = {
  showBanner: boolean;
  bannerProps: BannerProps | null;
};

/**
 * Computes the header banner state. Shared by the `/api/banner-data` route
 * (which polls for client-side refreshes) and the root layout (which renders
 * the initial state on the server so there is no appear-then-collapse layout
 * shift on first paint).
 *
 * `includeAuth` reads the session cookie to populate `isLoggedIn`/`isNotified`
 * for the event popup CTA. The layout passes `false` to avoid opting every page
 * into dynamic rendering — those two fields only affect the (portalled) popup,
 * never the banner's height, and the first client refresh fills them in.
 */
export async function getBannerData({
  fresh = false,
  includeAuth = false,
}: { fresh?: boolean; includeAuth?: boolean } = {}): Promise<BannerData> {
  try {
    const closestEvent = await getNextMilestoneEvent({ fresh });

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
    const hideTicketingDate = closestEvent?.hide_ticketing_date === true;
    const isBeforeTicketing =
      process.env.LOCAL_TICKETING_ENABLED !== "true" &&
      !isMystery &&
      !hideTicketingDate &&
      ticketingDate &&
      !Number.isNaN(ticketingDate.getTime()) &&
      now < ticketingDate;

    // Show banner if there's an upcoming event
    const showBanner = !!closestEvent;

    // "Happening now" = doors are open but the event hasn't ended (with grace).
    // EVENT_STILL_ALIVE already gates closestEvent, so we just need to confirm
    // that doors_open has passed.
    const doorsOpenDate = closestEvent?.doors_open
      ? new Date(closestEvent.doors_open)
      : null;
    const isHappeningNow =
      !isMystery &&
      !isBeforeTicketing &&
      !!doorsOpenDate &&
      !Number.isNaN(doorsOpenDate.getTime()) &&
      now >= doorsOpenDate;

    // Banner text and countdown target: reveal → tickets release → event
    const bannerText = isMystery
      ? BANNER_MESSAGES.NOTIFY_MESSAGE
      : isHappeningNow
        ? closestEvent?.name +
          (closestEvent?.name?.includes("and")
            ? BANNER_MESSAGES.EVENT_HAPPENING_NOW_MESSAGE_PLURAL
            : BANNER_MESSAGES.EVENT_HAPPENING_NOW_MESSAGE)
        : closestEvent?.name +
          (closestEvent?.name?.includes("and")
            ? BANNER_MESSAGES.EVENT_MESSAGE_PLURAL
            : BANNER_MESSAGES.EVENT_MESSAGE);

    const countdownTarget = isMystery
      ? closestEvent?.release_date
      : isBeforeTicketing
        ? (closestEvent?.ticketing_date ?? undefined)
        : isHappeningNow
          ? null
          : closestEvent?.doors_open;
    const prefaceLabel = isMystery
      ? BANNER_MESSAGES.COUNTDOWN_REVEAL_MESSAGE
      : isBeforeTicketing
        ? BANNER_MESSAGES.COUNTDOWN_TICKETS_MESSAGE
        : isHappeningNow
          ? ""
          : BANNER_MESSAGES.COUNTDOWN_EVENT_MESSAGE;

    const bannerHref = isMystery
      ? "/upcoming-speakers"
      : closestEvent
        ? `/events/${closestEvent.route}`
        : "/upcoming-speakers";

    // For the popup phase: check if ticketing has actually opened (ignores hideTicketingDate).
    // The banner uses isBeforeTicketing (which respects hideTicketingDate) for its own display,
    // but the popup needs the real ticketing state to show the correct CTA.
    const isActuallyBeforeTicketing =
      process.env.LOCAL_TICKETING_ENABLED !== "true" &&
      !isMystery &&
      ticketingDate &&
      !Number.isNaN(ticketingDate.getTime()) &&
      now < ticketingDate;

    const phase = isMystery
      ? ("mystery" as const)
      : isActuallyBeforeTicketing
        ? ("pre-ticketing" as const)
        : ("ticketing-open" as const);

    // Check if the user is already signed up for notifications. Skipped for the
    // server-rendered initial state so the layout stays statically renderable.
    let isLoggedIn = false;
    let isNotified = false;
    if (includeAuth) {
      try {
        const user = await getSessionUser();
        if (user?.email) {
          isLoggedIn = true;
          if (closestEvent) {
            const row = await db.query.notify.findFirst({
              where: and(
                eq(notify.email, user.email),
                eq(notify.speakerId, closestEvent.id),
              ),
              columns: { id: true },
            });
            isNotified = !!row;
          }
        }
      } catch {
        // Session/DB error — fail open, treat as not logged in
      }
    }

    return {
      showBanner,
      bannerProps: {
        text: bannerText,
        href: bannerHref,
        prefaceLabel,
        target: countdownTarget || null,
        eventId: closestEvent?.id ?? null,
        imageUrl:
          !isMystery &&
          closestEvent &&
          (closestEvent.img || closestEvent.mobile_img)
            ? getImageProxyUrl(closestEvent.id, closestEvent.img_version)
            : null,
        phase,
        eventRoute:
          !isMystery && closestEvent?.route ? closestEvent.route : null,
        speakerName:
          !isMystery && closestEvent?.name ? closestEvent.name : null,
        isLoggedIn,
        isNotified,
      },
    };
  } catch {
    return { showBanner: false, bannerProps: null };
  }
}
