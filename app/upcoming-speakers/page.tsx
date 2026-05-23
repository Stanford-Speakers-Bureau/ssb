import type { Metadata } from "next";
import { Suspense } from "react";
import NotifyHandler from "./NotifyHandler";
import EditorialTheme from "./themes/EditorialTheme";
import EmberTheme from "./themes/EmberTheme";
import PressTheme from "./themes/PressTheme";
import ArcadeTheme from "./themes/ArcadeTheme";
import MarqueeTheme from "./themes/MarqueeTheme";
import type { SpeakerCardVM } from "./themes/shared";
import { SAMPLE_VMS } from "./themes/sampleData";
import {
  EVENT_STILL_ALIVE,
  formatEventDate,
  formatTime,
  getImageProxyUrl,
  isEventMystery,
  serializeEvent,
} from "@/app/lib/supabase";
import { getSessionUser } from "@/app/lib/auth";
import { db, eq, count as dbCount, tickets, notify } from "@ssb/db";


const ogTitle = "Upcoming at Stanford";
const ogDescription =
  "See who's speaking next at Stanford. Browse upcoming events and grab your tickets.";

export const metadata: Metadata = {
  title: "Upcoming Speakers",
  description:
    "See who's speaking next at Stanford. Browse upcoming events hosted by Stanford Speakers Bureau and get your tickets.",
  openGraph: { title: ogTitle, description: ogDescription },
  twitter: { title: ogTitle, description: ogDescription },
};

type SanitizedEvent = {
  id: string;
  start_time_date: string | null;
  doors_open: string | null;
  release_date: string | null;
  venue: string | null;
  venue_link: string | null;
  name: string | null;
  desc: string | null;
  tagline: string | null;
  route: string | null;
  signedImageUrl: string | null;
  isMystery: boolean;
  capacity: number | null;
  ticketsSold: number | null;
  reserved: number | null;
};

async function getTicketCount(eventId: string): Promise<number> {
  try {
    const [result] = await db.select({ count: dbCount() })
      .from(tickets)
      .where(eq(tickets.eventId, eventId));
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}

async function getUpcomingEvents(): Promise<SanitizedEvent[]> {
  // Keep events visible until 6 hours past their effective end (end_time_date,
  // or start_time_date + 12 hours when end is missing).
  const rawEvents = await db.query.events.findMany({
    where: EVENT_STILL_ALIVE,
    orderBy: (events, { asc }) => [asc(events.startTimeDate)],
  }).catch((err: unknown) => {
    const cause = (err as Error & { cause?: Error })?.cause;
    console.error("[getUpcomingEvents] query failed:", cause?.message ?? (err as Error).message);
    throw err;
  });

  return await Promise.all(
    rawEvents.map(async (rawEvent) => {
      const event = serializeEvent(rawEvent);
      const isMystery = isEventMystery(event);

      const ticketsSold = isMystery ? null : await getTicketCount(event.id);

      return {
        id: event.id,
        start_time_date: isMystery ? null : event.start_time_date,
        doors_open: event.doors_open,
        release_date: event.release_date,
        venue: isMystery ? null : event.venue,
        venue_link: isMystery ? null : event.venue_link,
        name: isMystery ? null : event.name,
        desc: isMystery ? null : event.desc,
        tagline: isMystery ? null : event.tagline,
        route: isMystery ? null : event.route,
        signedImageUrl: isMystery
          ? null
          : getImageProxyUrl(event.id, event.img_version),
        isMystery,
        capacity: isMystery ? null : (event.capacity ?? null),
        ticketsSold: isMystery ? null : ticketsSold,
        reserved: isMystery ? null : (event.reserved ?? null),
      };
    }),
  );
}

async function getUserNotificationState(): Promise<{
  isLoggedIn: boolean;
  notifications: Set<string>;
}> {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return {
        isLoggedIn: false,
        notifications: new Set(),
      };
    }

    const notifications = await db.query.notify.findMany({
      where: eq(notify.email, user.email),
      columns: { speakerId: true },
    });

    return {
      isLoggedIn: true,
      notifications: new Set(notifications.map((n) => n.speakerId)),
    };
  } catch {
    return {
      isLoggedIn: false,
      notifications: new Set(),
    };
  }
}

/** Map a sanitized event to a theme-agnostic, presentation-ready view model. */
function toCardVM(e: SanitizedEvent, isAlreadyNotified: boolean): SpeakerCardVM {
  return {
    id: e.id,
    mystery: e.isMystery,
    name: e.isMystery ? "" : e.name ?? "",
    header: e.isMystery ? "" : e.tagline ?? "",
    dateText: formatEventDate(e.isMystery ? e.doors_open : e.start_time_date),
    doorsOpenText: e.doors_open ? `Doors open ${formatTime(e.doors_open)}` : "",
    eventTimeText:
      !e.isMystery && e.start_time_date
        ? `Starts at ${formatTime(e.start_time_date)}`
        : "",
    locationName: e.isMystery ? "" : e.venue ?? "",
    locationUrl: e.isMystery ? "" : e.venue_link ?? "",
    imageUrl: e.isMystery ? "" : e.signedImageUrl ?? "",
    ctaHref: e.isMystery ? "" : `/events/${e.route}`,
    ctaText: e.isMystery ? "" : "Get Tickets",
    revealDateRaw: e.isMystery ? e.release_date : null,
    capacity: e.isMystery ? null : e.capacity,
    ticketsSold: e.isMystery ? null : e.ticketsSold,
    reserved: e.isMystery ? null : e.reserved,
    isAlreadyNotified,
  };
}

export default async function UpcomingSpeakers() {
  const [events, userNotificationState] = await Promise.all([
    getUpcomingEvents(),
    getUserNotificationState(),
  ]);

  const realVms = events.map((e) =>
    toCardVM(e, userNotificationState.notifications.has(e.id)),
  );

  // In dev, fall back to sample speakers so the theme picker is previewable
  // even with no live events. Never used in production.
  const vms =
    realVms.length === 0 && process.env.NODE_ENV === "development"
      ? SAMPLE_VMS
      : realVms;

  const hasEvents = vms.length > 0;
  const isLoggedIn = userNotificationState.isLoggedIn;
  const themeProps = { vms, hasEvents, isLoggedIn };

  return (
    <>
      <Suspense fallback={null}>
        <NotifyHandler />
      </Suspense>

      {/* Theme exploration — pick a direction in the ui.sh toolbar.
          All directions are dark; cardinal red is kept across every option. */}
      <div data-uidotsh-pick="Speaker page theme" className="contents">
        <div data-uidotsh-option="Editorial Dark (current)" className="contents" hidden>
          <EditorialTheme {...themeProps} />
        </div>
        <div data-uidotsh-option="Ember (warm dark)" className="contents">
          <EmberTheme {...themeProps} />
        </div>
        <div data-uidotsh-option="Press (screenprint)" className="contents" hidden>
          <PressTheme {...themeProps} />
        </div>
        <div data-uidotsh-option="Midnight Arcade (neon glow)" className="contents" hidden>
          <ArcadeTheme {...themeProps} />
        </div>
        <div data-uidotsh-option="Marquee Ticket" className="contents" hidden>
          <MarqueeTheme {...themeProps} />
        </div>
      </div>
    </>
  );
}
