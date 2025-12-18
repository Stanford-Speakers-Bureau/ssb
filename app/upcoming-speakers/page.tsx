import { Suspense } from "react";
import UpcomingSpeakerCard from "@/app/components/UpcomingSpeakerCard";
import NotifyHandler from "./NotifyHandler";
import { SuggestSpeakerButton } from "./SuggestSpeakerButton";
import {
  createServerSupabaseClient,
  formatEventDate,
  formatTime,
  getSignedImageUrl,
  getSupabaseClient,
  isEventMystery,
} from "@/app/lib/supabase";
import WaitForImages from "@/app/components/WaitForImages";

type SanitizedEvent = {
  id: string;
  start_time_date: string | null;
  doors_open: string | null;
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
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    if (error) {
      console.error("Ticket count error:", error);
      return 0;
    }

    return count ?? 0;
  } catch {
    return 0;
  }
}

async function getUpcomingEvents(): Promise<SanitizedEvent[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("start_time_date", { ascending: true });

  if (error) {
    return [];
  }

  const events = (data || []) as Array<{
    id: string;
    start_time_date: string | null;
    doors_open: string | null;
    venue: string | null;
    venue_link: string | null;
    name: string | null;
    desc: string | null;
    tagline: string | null;
    route: string | null;
    img: string | null;
    capacity: number | null;
    reserved: number | null;
    speaker_id?: string | null;
    release_date: string | null;
  }>;

  return await Promise.all(
    events.map(async (event) => {
      const isMystery = isEventMystery(event);

      // Fetch ticket count for non-mystery events
      const ticketsSold = isMystery ? null : await getTicketCount(event.id);

      // Only expose safe fields - never leak speaker info for mystery events
      return {
        id: event.id,
        start_time_date: event.start_time_date,
        doors_open: event.doors_open,
        venue: event.venue,
        venue_link: event.venue_link,
        name: isMystery ? null : event.name,
        desc: isMystery ? null : event.desc,
        tagline: isMystery ? null : event.tagline,
        route: isMystery ? null : event.route,
        signedImageUrl: isMystery
          ? null
          : await getSignedImageUrl(event.img, 60),
        isMystery,
        capacity: isMystery ? null : (event.capacity ?? null),
        ticketsSold: isMystery ? null : ticketsSold,
        reserved: isMystery ? null : (event.reserved ?? null),
      };
    }),
  );
}

async function getUserNotifications(): Promise<Set<string>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return new Set();

    const adminClient = getSupabaseClient();
    const { data } = await adminClient
      .from("notify")
      .select("speaker_id")
      .eq("email", user.email);

    return new Set(data?.map((n) => n.speaker_id) || []);
  } catch {
    return new Set();
  }
}

export default async function UpcomingSpeakers() {
  const [events, userNotifications] = await Promise.all([
    getUpcomingEvents(),
    getUserNotifications(),
  ]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl flex flex-col lg:py-8 py-6 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-8 font-serif">
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
            <div className="space-y-8">
              {events.map((event) => (
                <WaitForImages
                  key={event.id}
                  urls={event.signedImageUrl ? [event.signedImageUrl] : []}
                  maxToWait={1}
                  timeoutMs={12000}
                  fallback={
                    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black">
                      <div className="flex items-center gap-3 text-zinc-200">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="text-sm font-medium">Loading…</span>
                      </div>
                    </div>
                  }
                >

                  <UpcomingSpeakerCard
                    key={event.id}
                    name={event.isMystery ? "???" : event.name || "???"}
                    header={
                      event.isMystery
                        ? "Speaker — To Be Announced"
                        : event.tagline || ""
                    }
                    dateText={formatEventDate(event.start_time_date)}
                    doorsOpenText={
                      !event.isMystery && event.doors_open
                        ? `Doors open at ${formatTime(event.doors_open)}`
                        : ""
                    }
                    eventTimeText={
                      event.start_time_date
                        ? `Event starts at ${formatTime(event.start_time_date)}`
                        : ""
                    }
                    locationName={event.isMystery ? "" : event.venue || ""}
                    locationUrl={event.isMystery ? "" : event.venue_link || ""}
                    backgroundImageUrl={
                      event.isMystery
                        ? "/speakers/mystery.jpg"
                        : event.signedImageUrl || "/speakers/mystery.jpg"
                    }
                    ctaHref={event.isMystery ? "" : `/events/${event.route}`}
                    ctaText={event.isMystery ? "" : "Get Tickets"}
                    mystery={event.isMystery}
                    eventId={event.id}
                    isAlreadyNotified={userNotifications.has(event.id)}
                    capacity={event.capacity}
                    ticketsSold={event.ticketsSold}
                    reserved={event.reserved}
                  />
                </WaitForImages>
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

          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-6 mt-0 text-center drop-shadow-lg">
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
