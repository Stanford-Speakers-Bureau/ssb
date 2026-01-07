import { redirect } from "next/navigation";
import Image from "next/image";
import WaitForImages from "@/app/components/WaitForImages";
import {
  getEventByRoute,
  isEventMystery,
  getImageProxyUrl,
  formatEventDate,
  formatTime,
  createServerSupabaseClient,
  getSupabaseClient,
  getAvailablePublicTickets,
} from "@/app/lib/supabase";
import { generateGoogleCalendarUrl } from "@/app/lib/utils";
import TicketSection from "./TicketSection";

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

  if (!event) {
    redirect("/upcoming-speakers");
  }

  const [ticketStatus] = await Promise.all([getUserTicketStatus(event.id)]);

  const hasTicket = !!ticketStatus.ticketId;
  const ticketId = ticketStatus.ticketId;
  const ticketType = ticketStatus.ticketType;

  // Check if public tickets are sold out
  // Uses unified helper that excludes VIP tickets
  const ticketInfo = await getAvailablePublicTickets(event.id);
  const isSoldOut = event.capacity ? ticketInfo.available <= 0 : false;

  // If no event found or event is still a mystery, redirect to upcoming events
  if (isEventMystery(event) && !hasTicket) {
    redirect("/upcoming-speakers");
  }

  // Get the proxy URL for the event image
  const signedImageUrl = event.img
    ? getImageProxyUrl(event.id, event.img_version)
    : null;

  return (
    <div className="relative isolate flex flex-col items-center font-sans min-h-screen">
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
                  className="object-cover object-right"
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

          <main className="relative z-20 flex w-full flex-1 justify-center pt-24">
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

                <div className="space-y-2 md:space-y-3 mb-6">
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
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="text-sm sm:text-base text-white font-medium">
                          Event starts: {formatTime(event.start_time_date)}
                        </p>
                      </div>
                    </>
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

                  {/*{event.capacity && (*/}
                  {/*  <TicketCount*/}
                  {/*    eventId={event.id}*/}
                  {/*    initialCapacity={event.capacity}*/}
                  {/*    initialTicketsSold={*/}
                  {/*      (event.tickets ?? event.reserved) || 0*/}
                  {/*    }*/}
                  {/*    reserved={event.reserved}*/}
                  {/*  />*/}
                  {/*)}*/}

                  {event.start_time_date && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {generateGoogleCalendarUrl({
                        name: event.name,
                        desc: event.desc || undefined,
                        start_time_date: event.start_time_date,
                        venue: event.venue || undefined,
                        venue_link: event.venue_link || undefined,
                        route: event.route || undefined,
                      }) && (
                        <a
                          href={generateGoogleCalendarUrl({
                            name: event.name,
                            desc: event.desc || undefined,
                            start_time_date: event.start_time_date,
                            venue: event.venue || undefined,
                            venue_link: event.venue_link || undefined,
                            route: event.route || undefined,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              fill="#4285F4"
                            />
                            <path
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              fill="#34A853"
                            />
                            <path
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              fill="#FBBC05"
                            />
                            <path
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              fill="#EA4335"
                            />
                          </svg>
                          Add to Google Calendar
                        </a>
                      )}
                    </div>
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
                  isSoldOut={isSoldOut}
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
