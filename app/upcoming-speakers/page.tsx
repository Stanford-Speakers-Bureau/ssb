import { Suspense } from "react";
import UpcomingSpeakerCard from "../components/UpcomingSpeakerCard";
import NotifyHandler from "./NotifyHandler";
import { getSupabaseClient, createServerSupabaseClient, formatEventDate, formatTime, generateICalUrl, getSignedImageUrl, isEventMystery, type Event } from "../lib/supabase";

type SanitizedEvent = {
  id: string;
  start_time_date: string | null;
  doors_open: string | null;
  venue: string | null;
  venue_link: string | null;
  name: string | null;
  desc: string | null;
  signedImageUrl: string | null;
  isMystery: boolean;
};

async function getUpcomingEvents(): Promise<SanitizedEvent[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("start_time_date", new Date().toISOString())
    .order("start_time_date", { ascending: true });

  if (error) {
    console.error("Error fetching events:", error);
    return [];
  }

  const events = data || [];

  const sanitizedEvents = await Promise.all(
    events.map(async (event) => {
      const isMystery = isEventMystery(event);

      // Only expose safe fields - never leak speaker info for mystery events
      return {
        id: event.id,
        start_time_date: event.start_time_date,
        doors_open: event.doors_open,
        venue: event.venue,
        venue_link: event.venue_link,
        name: isMystery ? null : event.name,
        desc: isMystery ? null : event.desc,
        signedImageUrl: isMystery ? null : await getSignedImageUrl(event.img, 60),
        isMystery,
      };
    })
  );

  return sanitizedEvents;
}

async function getUserNotifications(): Promise<Set<string>> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.email) return new Set();

    const adminClient = getSupabaseClient();
    const { data } = await adminClient
      .from("notify")
      .select("speaker_id")
      .eq("email", user.email);

    return new Set(data?.map(n => n.speaker_id) || []);
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
        <section className="w-full max-w-5xl flex flex-col py-12 px-6 sm:px-12 md:px-16">
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
                <UpcomingSpeakerCard
                  key={event.id}
                  name={event.isMystery ? "???" : event.name || "???"}
                  header={event.isMystery ? "Speaker — To Be Announced" : event.desc || ""}
                  dateText={formatEventDate(event.start_time_date)}
                  doorsOpenText={event.doors_open ? `Doors open at ${formatTime(event.doors_open)}` : ""}
                  eventTimeText={event.start_time_date ? `Event starts at ${formatTime(event.start_time_date)}` : ""}
                  locationName={event.venue || ""}
                  locationUrl={event.venue_link || ""}
                  backgroundImageUrl={event.isMystery ? "/speakers/mystery.jpg" : event.signedImageUrl || "/speakers/mystery.jpg"}
                  mystery={event.isMystery}
                  calendarUrl={event.isMystery ? "" : generateICalUrl(event)}
                  eventId={event.id}
                  isAlreadyNotified={userNotifications.has(event.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
