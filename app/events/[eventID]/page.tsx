import { redirect } from "next/navigation";
import {
  getEventByRoute,
  isEventMystery,
  getSignedImageUrl,
  formatEventDate,
  formatTime,
} from "../../lib/supabase";

interface PageProps {
  params: Promise<{ eventID: string }>;
}

export default async function EventPage({ params }: PageProps) {
  const { eventID } = await params;

  const event = await getEventByRoute(eventID);

  // If no event found or event is still a mystery, redirect to upcoming events
  if (!event || isEventMystery(event)) {
    redirect("/upcoming-speakers");
  }

  // Get the signed image URL for the event
  const signedImageUrl = await getSignedImageUrl(event.img, 3600);

  return (
    <div
      className="flex min-h-screen flex-col items-center font-sans relative"
      style={{
        backgroundImage: signedImageUrl ? `url(${signedImageUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Semi-transparent overlay for better text readability */}
      <div className="absolute inset-0 bg-black/70 z-0"></div>

      <main className="flex w-full flex-1 justify-center pt-8 md:pt-16 relative z-10">
        <section className="w-full max-w-5xl flex flex-col py-6 md:py-12 px-4 sm:px-6 md:px-12 lg:px-16">
          <div className="p-4 md:p-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4 font-serif">
              {event.name}
            </h1>

            {event.desc && (
              <p className="text-sm sm:text-base md:text-lg text-zinc-200 mb-4 md:mb-6 italic">
                {event.desc}
              </p>
            )}

            <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
              {event.start_time_date && (
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-sm sm:text-base text-white font-medium">
                    {formatEventDate(event.start_time_date)} at{" "}
                    {formatTime(event.start_time_date)}
                  </p>
                </div>
              )}

              {event.venue && (
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {event.venue_link ? (
                    <a
                      href={event.venue_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm sm:text-base text-white font-medium underline decoration-zinc-300 decoration-1 underline-offset-2 transition-all hover:scale-105 active:scale-95 inline-block"
                    >
                      {event.venue}
                    </a>
                  ) : (
                    <p className="text-sm sm:text-base text-white font-medium">
                      {event.venue}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded px-4 md:px-6 py-3 md:py-4 mb-4 md:mb-6">
              <p className="text-white text-sm sm:text-base leading-relaxed">
                <span className="font-semibold">Stanford Community Only.</span>{" "}
                This event is exclusively for Stanford faculty and students.
                Valid SUNET identification will be verified at entry.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
