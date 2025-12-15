import { redirect } from "next/navigation";
import Image from "next/image";
import WaitForImages from "../../components/WaitForImages";
import {
  getEventByRoute,
  isEventMystery,
  getSignedImageUrl,
  formatEventDate,
  formatTime,
  createServerSupabaseClient,
  getSupabaseClient,
} from "../../lib/supabase";
import TicketSection from "./TicketSection";
import TicketCount from "./TicketCount";

interface PageProps {
  params: Promise<{ eventID: string }>;
}

async function getUserTicketStatus(eventId: string): Promise<{
  ticketId: string | null;
  userEmail: string | null;
  ticketType: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email)
      return { ticketId: null, userEmail: null, ticketType: null };

    const adminClient = getSupabaseClient();
    const { data } = await adminClient
      .from("tickets")
      .select("id, type")
      .eq("event_id", eventId)
      .eq("email", user.email)
      .single();

    return { 
      ticketId: data?.id ?? null, 
      userEmail: user.email,
      ticketType: data?.type ?? null,
    };
  } catch {
    return { ticketId: null, userEmail: null, ticketType: null };
  }
}

export default async function EventPage({ params }: PageProps) {
  const { eventID } = await params;

  const event = await getEventByRoute(eventID);

  // If no event found or event is still a mystery, redirect to upcoming events
  if (!event || isEventMystery(event)) {
    redirect("/upcoming-speakers");
  }

  // Get the signed image URL for the event and check if user has a ticket
  const [signedImageUrl, ticketStatus] = await Promise.all([
    getSignedImageUrl(event.img, 3600),
    getUserTicketStatus(event.id),
  ]);

  const hasTicket = !!ticketStatus.ticketId;
  const ticketId = ticketStatus.ticketId;
  const ticketType = ticketStatus.ticketType;

  return (
    <div className="relative isolate flex min-h-screen flex-col items-center font-sans">
      <WaitForImages
        urls={signedImageUrl ? [signedImageUrl] : []}
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
        <>
          {/* Background Image */}
          {signedImageUrl && (
            <div className="fixed inset-0 z-0">
              <div className="relative w-full h-full">
                <Image
                  src={signedImageUrl}
                  alt={event.name || "Event"}
                  fill
                  className="object-cover"
                  priority
                  quality={90}
                  sizes="100vw"
                  unoptimized
                />
              </div>
            </div>
          )}
          {/* Semi-transparent overlay for better text readability */}
          <div className="fixed inset-0 bg-black/70 z-10"></div>

          <main className="relative z-20 flex w-full flex-1 justify-center pt-16">
            <section className="w-full max-w-5xl lg:py-8 py-6 px-6 sm:px-12 md:px-16">
              <div className="">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4 font-serif">
                  {event.name}
                </h1>

                {event.tagline && (
                  <p className="text-sm sm:text-base md:text-lg text-zinc-200 mb-4 md:mb-6 italic">
                    {event.tagline}
                  </p>
                )}

                {event.desc && (
                  <div className="mb-4 md:mb-6">
                    <p className="text-sm sm:text-base md:text-lg text-white leading-relaxed">
                      {event.desc}
                    </p>
                  </div>
                )}

                <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                  {event.start_time_date && (
                    <>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 text-red-500 shrink-0"
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
                          Date: {formatEventDate(event.start_time_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 text-red-500 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="text-sm sm:text-base text-white font-medium">
                          Event starts: {formatTime(event.start_time_date)}
                        </p>
                      </div>
                    </>
                  )}

                  {event.doors_open && (
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 md:w-5 md:h-5 text-red-500 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M13 4h3a2 2 0 0 1 2 2v14" />
                        <path d="M2 20h3" />
                        <path d="M13 20h9" />
                        <path d="M10 12v.01" />
                        <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4.742-1.186A1 1 0 0 1 13 4.56z" />
                      </svg>
                      <p className="text-sm sm:text-base text-white font-medium">
                        Doors open: {formatTime(event.doors_open)}
                      </p>
                    </div>
                  )}

                  {event.venue && (
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 md:w-5 md:h-5 text-red-500 shrink-0"
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

                  {event.capacity && (
                    <TicketCount
                      eventId={event.id}
                      initialCapacity={event.capacity}
                      initialTicketsSold={
                        (event.tickets ?? event.reserved) || 0
                      }
                      reserved={event.reserved}
                    />
                  )}
                </div>

                <TicketSection
                  eventId={event.id}
                  initialHasTicket={hasTicket}
                  initialTicketId={ticketId}
                  initialTicketType={ticketType}
                  userEmail={ticketStatus.userEmail}
                  eventRoute={event.route || eventID}
                  eventStartTime={event.start_time_date}
                />

                {/*<div className="bg-white/10 backdrop-blur-sm rounded px-4 md:px-6 py-3 md:py-4 mb-4 md:mb-6">*/}
                {/*  <p className="text-white text-sm sm:text-base leading-relaxed">*/}
                {/*    <span className="font-semibold">*/}
                {/*      Stanford Community Only.*/}
                {/*    </span>{" "}*/}
                {/*    This event is exclusively for Stanford faculty and students.*/}
                {/*    Valid SUNET identification will be verified at entry.*/}
                {/*  </p>*/}
                {/*</div>*/}
              </div>
            </section>
          </main>
        </>
      </WaitForImages>
    </div>
  );
}
