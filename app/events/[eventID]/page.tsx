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
  isEventUnderCapacity,
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
  ticketName: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email)
      return { ticketId: null, userEmail: null, ticketType: null, ticketName: null };

    const adminClient = getSupabaseClient();
    const { data } = await adminClient
      .from("tickets")
      .select("id, type, name")
      .eq("event_id", eventId)
      .eq("email", user.email)
      .single();

    return {
      ticketId: data?.id ?? null,
      userEmail: user.email,
      ticketType: data?.type ?? null,
      ticketName: data?.name ?? null,
    };
  } catch {
    return { ticketId: null, userEmail: null, ticketType: null, ticketName: null };
  }
}

async function getUserNotificationStatus(eventId: string): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return false;

    const adminClient = getSupabaseClient();
    const { data, error } = await adminClient
      .from("notify")
      .select("id")
      .eq("email", user.email)
      .eq("speaker_id", eventId)
      .maybeSingle();

    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

export default async function EventPage({ params }: PageProps) {
  const { eventID } = await params;

  const event = await getEventByRoute(eventID);

  if (!event) {
    redirect("/upcoming-speakers");
  }

  const [ticketStatus, isNotified] = await Promise.all([
    getUserTicketStatus(event.id),
    getUserNotificationStatus(event.id),
  ]);

  const hasTicket = !!ticketStatus.ticketId;
  const ticketId = ticketStatus.ticketId;
  const ticketType = ticketStatus.ticketType;

  // Check if public tickets are sold out
  const isSoldOut = !(await isEventUnderCapacity(event.id));

  // If no event found or event is still a mystery, redirect to upcoming events
  if (isEventMystery(event) && !hasTicket) {
    redirect("/upcoming-speakers");
  }

  // Get the proxy URL for the event image
  const signedImageUrl = event.img
    ? getImageProxyUrl(event.id, event.img_version)
    : null;

  // Pre-compute the calendar URL once
  const calendarUrl = event.start_time_date
    ? generateGoogleCalendarUrl({
      name: event.name,
      desc: event.desc || undefined,
      start_time_date: event.start_time_date,
      venue: event.venue || undefined,
      venue_link: event.venue_link || undefined,
      route: event.route || undefined,
    })
    : null;

  return (
    <div className="relative isolate flex flex-col items-center font-sans min-h-screen bg-black">
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

          {/* Multi-stop gradient overlay */}
          <div
            className="fixed inset-0 z-10"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.8) 65%, rgba(0,0,0,0.92) 100%)",
            }}
          />

          <main className="relative z-20 flex w-full flex-1 justify-center pt-20 sm:pt-24">
            <section className="w-full max-w-3xl px-5 sm:px-8 lg:max-w-6xl lg:px-12 py-6 lg:py-10">
              {/* Frosted glass content panel */}
              <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 sm:p-8 lg:p-10 shadow-2xl">
                {/* Title + tagline — full width */}
                <h1 className="text-center lg:text-left text-3xl sm:text-4xl lg:text-5xl font-bold text-white font-serif tracking-tight leading-tight">
                  {event.name}
                </h1>

                {event.tagline && (
                  <p className="text-center lg:text-left mt-3 text-base sm:text-lg lg:text-xl text-zinc-300 italic leading-relaxed">
                    {event.tagline}
                  </p>
                )}

                {/* Two-column grid on lg+ */}
                <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-2 lg:gap-10">
                  {/* ── Left column: event details ── */}
                  <div className="text-center lg:text-left">
                    {/* Metadata card */}
                    {(event.start_time_date || event.doors_open || event.venue) && (
                      <div className="rounded-xl bg-white/[0.06] border border-white/[0.08] divide-y divide-white/[0.06]">
                        {event.start_time_date && (
                          <div className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
                            <svg
                              className="w-4 h-4 text-red-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.5}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                              />
                            </svg>
                            <span className="text-sm sm:text-base text-white font-medium">
                              {formatEventDate(event.start_time_date)}
                            </span>
                          </div>
                        )}

                        {event.doors_open && (
                          <div className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
                            <svg
                              className="w-4 h-4 text-red-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.5}
                              viewBox="0 0 24 24"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M13 4h3a2 2 0 0 1 2 2v14" />
                              <path d="M2 20h3" />
                              <path d="M13 20h9" />
                              <path d="M10 12v.01" />
                              <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4.742-1.186A1 1 0 0 1 13 4.56z" />
                            </svg>
                            <span className="text-sm sm:text-base text-white font-medium">
                              Doors open at {formatTime(event.doors_open)}
                            </span>
                          </div>
                        )}

                        {event.start_time_date && (
                          <div className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
                            <svg
                              className="w-4 h-4 text-red-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.5}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="text-sm sm:text-base text-white font-medium">
                              Starts at {formatTime(event.start_time_date)}
                            </span>
                          </div>
                        )}

                        {event.venue && (
                          <div className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
                            <svg
                              className="w-4 h-4 text-red-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.5}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                              />
                            </svg>
                            {event.venue_link ? (
                              <a
                                href={event.venue_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm sm:text-base text-white font-medium underline decoration-white/30 decoration-1 underline-offset-2 transition-colors hover:decoration-white/60"
                              >
                                {event.venue}
                              </a>
                            ) : (
                              <span className="text-sm sm:text-base text-white font-medium">
                                {event.venue}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    {event.desc && (
                      <div className="mt-5 lg:mt-6">
                        <p className="text-sm sm:text-base text-zinc-200 leading-relaxed text-left">
                          {event.desc}
                        </p>
                      </div>
                    )}

                    {/* Calendar link */}
                    {calendarUrl && (
                      <div className="mt-5 lg:mt-6">
                        <a
                          href={calendarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 transition-all hover:bg-white/[0.08] hover:text-white hover:border-white/25 active:scale-[0.98]"
                        >
                          <svg
                            className="w-4 h-4 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                            />
                          </svg>
                          Add to Google Calendar
                        </a>
                      </div>
                    )}

                    {/* Entry requirements */}
                    <div className="mt-5 lg:mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                      <h3 className="text-sm font-medium text-amber-200 mb-2">
                        Prohibited Items
                      </h3>
                      <ul className="text-sm text-amber-100/90 space-y-1 list-disc list-inside">
                        <li>No bags, including purses</li>
                        <li>No water bottles</li>
                      </ul>
                    </div>
                  </div>

                  {/* ── Right column: ticket section ── */}
                  <div className="mt-6 pt-6 border-t border-white/[0.06] lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:border-white/[0.06] lg:pl-10 text-center lg:text-left">
                    <TicketSection
                      eventId={event.id}
                      initialHasTicket={hasTicket}
                      initialTicketId={ticketId}
                      initialTicketType={ticketType}
                      initialTicketName={ticketStatus.ticketName}
                      userEmail={ticketStatus.userEmail}
                      eventRoute={event.route || eventID}
                      eventStartTime={event.start_time_date}
                      doorsOpen={event.doors_open}
                      isSoldOut={isSoldOut}
                      ticketingDate={event.ticketing_date ?? event.release_date}
                      initialIsNotified={isNotified}
                    />
                  </div>
                </div>

                {/* ADA notice — full width */}
                <p className="mt-8 text-center lg:text-left text-xs sm:text-sm text-zinc-500 leading-relaxed">
                  For ADA accommodations, please email{" "}
                  <a
                    href="mailto:tickets@stanfordspeakersbureau.com"
                    className="text-zinc-400 underline underline-offset-2 decoration-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    tickets@stanfordspeakersbureau.com
                  </a>
                </p>
              </div>
            </section>
          </main>
        </>
      </WaitForImages>
    </div>
  );
}
