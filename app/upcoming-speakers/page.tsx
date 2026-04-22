import type { Metadata } from "next";
import { Suspense } from "react";
import UpcomingSpeakerCard from "@/app/components/UpcomingSpeakerCard";
import NotifyHandler from "./NotifyHandler";
import { SuggestSpeakerButton } from "./SuggestSpeakerButton";
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

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-24">
        <section className="w-full max-w-6xl flex flex-col lg:py-8 py-6 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl text-black dark:text-white mb-8 font-serif">
            Upcoming Speakers
          </h1>

          <Suspense fallback={null}>
            <NotifyHandler />
          </Suspense>

          {events.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">
              No upcoming events at this time. Check back soon!
            </p>
          ) : (
            <div className="space-y-12">
              {events.map((event) => (
                <UpcomingSpeakerCard
                  key={event.id}
                  name={event.isMystery ? "???" : event.name || "???"}
                  header={
                    event.isMystery
                      ? "Speaker — To Be Announced"
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
          )}

          <div className="mt-5 mb-10 flex flex-col gap-4 rounded bg-zinc-100/80 p-6 text-black dark:bg-zinc-900 dark:text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">
                Want to see someone on stage? Suggest a speaker!
              </p>
            </div>
            <SuggestSpeakerButton />
          </div>

          <h2 className="text-2xl sm:text-3xl font-serif text-black dark:text-white mb-6 mt-0 text-center drop-shadow-lg">
            To Hear About Upcoming Events:
          </h2>

          <div className="flex justify-center mb-10">
            <a
              href="https://mailman.stanford.edu/mailman/listinfo/ssb-announce"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded px-6 py-3 text-base font-semibold text-white bg-[#A80D0C] transform transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 hover:brightness-110 hover:bg-[#C11211]"
            >
              Join Our Mailing List
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
