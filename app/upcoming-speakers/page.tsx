import type { Metadata } from "next";
import { Suspense } from "react";
import UpcomingSpeakerCard from "@/app/components/UpcomingSpeakerCard";
import NotifyHandler from "./NotifyHandler";
import { SuggestSpeakerButton } from "./SuggestSpeakerButton";
import UpcomingHero from "./UpcomingHero";
import EmptyEventsState from "./EmptyEventsState";
import {
  formatEventDate,
  formatTime,
  getImageProxyUrl,
  isEventMystery,
  serializeEvent,
} from "@/app/lib/supabase";
import { getSessionUser } from "@/app/lib/auth";
import { db, eq, gte, count as dbCount, events, tickets, notify } from "@ssb/db";


export const metadata: Metadata = {
  title: "Upcoming Speakers",
  description:
    "See who's speaking next at Stanford. Browse upcoming events hosted by Stanford Speakers Bureau and get your tickets.",
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
  const bufferDate = new Date();
  bufferDate.setDate(bufferDate.getDate() - 2);

  const rawEvents = await db.query.events.findMany({
    where: gte(events.startTimeDate, bufferDate),
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

export default async function UpcomingSpeakers() {
  const [events, userNotificationState] = await Promise.all([
    getUpcomingEvents(),
    getUserNotificationState(),
  ]);

  const hasEvents = events.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--ssb-paper)] font-sans text-[var(--ssb-ink)]">
      <UpcomingHero hasEvents={hasEvents} />

      <Suspense fallback={null}>
        <NotifyHandler />
      </Suspense>

      {hasEvents ? (
        <section className="px-6 py-16 sm:py-20 sm:px-12">
          <div className="mx-auto flex max-w-5xl flex-col gap-12">
            {events.map((event, i) => (
              <UpcomingSpeakerCard
                key={event.id}
                index={i}
                name={event.isMystery ? "???" : event.name || "???"}
                header={
                  event.isMystery
                    ? "Speaker: To Be Announced"
                    : event.tagline || ""
                }
                dateText={formatEventDate(event.isMystery ? event.doors_open : event.start_time_date)}
                doorsOpenText={
                  event.doors_open
                    ? `Doors open ${formatTime(event.doors_open)}`
                    : ""
                }
                eventTimeText={
                  !event.isMystery && event.start_time_date
                    ? `Starts at ${formatTime(event.start_time_date)}`
                    : ""
                }
                locationName={event.isMystery ? "" : event.venue || ""}
                locationUrl={event.isMystery ? "" : event.venue_link || ""}
                backgroundImageUrl={
                  event.isMystery
                    ? ""
                    : event.signedImageUrl || ""
                }
                ctaHref={event.isMystery ? "" : `/events/${event.route}`}
                ctaText={event.isMystery ? "" : "Get Tickets"}
                mystery={event.isMystery}
                eventDateRaw={event.isMystery ? event.release_date : null}
                eventId={event.id}
                isAlreadyNotified={userNotificationState.notifications.has(event.id)}
                isLoggedIn={userNotificationState.isLoggedIn}
                capacity={event.capacity}
                ticketsSold={event.ticketsSold}
                reserved={event.reserved}
              />
            ))}
          </div>
        </section>
      ) : (
        <EmptyEventsState />
      )}

      <section className="border-t border-white/10 bg-[var(--ssb-paper-strong)] px-6 py-16 sm:py-24 sm:px-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="mb-3 text-xs font-sans uppercase tracking-[0.3em] text-[#A80D0C] sm:text-sm">
            Don&rsquo;t see them?
          </p>
          <h2 className="font-serif text-3xl text-white leading-[1.05] sm:text-5xl">
            Suggest a speaker.
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-base leading-relaxed text-[#f5e8dc]/80 sm:text-lg">
            Drop a name. Top picks become the outreach list for our booking
            team — your suggestion is what fills the calendar above.
          </p>
          <div className="mt-8">
            <SuggestSpeakerButton />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[var(--ssb-paper)] px-6 py-16 sm:py-24 sm:px-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="mb-3 text-xs font-sans uppercase tracking-[0.3em] text-[#A80D0C] sm:text-sm">
            Stay in the loop
          </p>
          <h2 className="font-serif text-3xl text-white leading-[1.05] sm:text-5xl">
            Hear about every upcoming speaker.
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-base leading-relaxed text-[#f5e8dc]/80 sm:text-lg">
            One email per event. We don&rsquo;t spam — we just tell you
            who&rsquo;s coming and when tickets drop.
          </p>
          <a
            href="https://mailman.stanford.edu/mailman/listinfo/ssb-announce"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex rounded-full border border-[#f2ded0]/50 bg-[#fff8f1] px-8 py-3.5 text-sm font-semibold text-[#1c1614] shadow-[0_12px_35px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 hover:bg-white sm:text-base"
          >
            Join the Mailing List
          </a>
        </div>
      </section>
    </div>
  );
}
