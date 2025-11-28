import UpcomingSpeakerCard from "../components/UpcomingSpeakerCard";
import { getSupabaseClient, formatEventDate, formatTime, generateICalUrl, getSignedImageUrl, type Event } from "../lib/supabase";

type EventWithSignedUrl = Event & { signedImageUrl: string | null };

async function getUpcomingEvents(): Promise<EventWithSignedUrl[]> {
  const supabase = getSupabaseClient();
  
  // Fetch events where start_time_date is in the future
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

  // Fetch signed URLs for all event images
  const eventsWithUrls = await Promise.all(
    events.map(async (event) => ({
      ...event,
      signedImageUrl: await getSignedImageUrl(event.img, 60),
    }))
  );

  return eventsWithUrls;
}

export default async function UpcomingSpeakers() {
  const events = await getUpcomingEvents();

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl flex flex-col py-12 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-8 font-serif">
            Upcoming Speakers
          </h1>
          
          {events.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">
              No upcoming events at this time. Check back soon!
            </p>
          ) : (
            <div className="space-y-8">
              {events.map((event) => {
                // Determine if this is a mystery/unreleased speaker
                // Mystery if current date is before release_date
                const now = new Date();
                const releaseDate = event.release_date ? new Date(event.release_date) : null;
                const isMystery = releaseDate ? now < releaseDate : !event.name;
                const displayName = isMystery ? "???" : event.name || "???";
                const header = isMystery 
                  ? "Speaker — To Be Announced" 
                  : event.desc || "";

                return (
                  <UpcomingSpeakerCard
                    key={event.id}
                    name={displayName}
                    header={header}
                    dateText={formatEventDate(event.start_time_date)}
                    doorsOpenText={event.doors_open ? `Doors open at ${formatTime(event.doors_open)}` : ""}
                    eventTimeText={event.start_time_date ? `Event starts at ${formatTime(event.start_time_date)}` : ""}
                    locationName={event.venue || ""}
                    locationUrl={event.venue_link || ""}
                    backgroundImageUrl={isMystery ? "/speakers/mystery.jpg" : event.signedImageUrl || "/speakers/mystery.jpg"}
                    mystery={isMystery}
                    calendarUrl={isMystery ? "" : generateICalUrl(event)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
