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
    <div className="relative flex flex-col font-sans min-h-screen bg-zinc-950">
      <WaitForImages
        urls={signedImageUrl ? [signedImageUrl] : []}
        maxToWait={1}
        timeoutMs={12000}
        fallback={
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-zinc-950">
            <div className="flex items-center gap-3 text-zinc-200">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading…</span>
            </div>
          </div>
        }
      >
        <>
          {/* ─── Hero section with contained image ─── */}
          <section className="relative w-full overflow-hidden">
            {/* Speaker image – contained to hero only */}
            {signedImageUrl && (
              <div className="absolute inset-0">
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
            )}

            {/* Bottom fade into page background */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgb(9,9,11) 0%, rgba(9,9,11,0.85) 30%, rgba(9,9,11,0.35) 60%, rgba(9,9,11,0.25) 100%)",
              }}
            />

            {/* Centered fade for text readability */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, transparent 0%, rgba(9,9,11,0.4) 25%, rgba(9,9,11,0.88) 50%, rgba(9,9,11,0.4) 75%, transparent 100%)",
              }}
            />

            {/* Hero content – anchored bottom-left */}
            <div className="relative z-10 flex flex-col justify-end min-h-[70vh] sm:min-h-[78vh] lg:min-h-[85vh] max-w-6xl mx-auto w-full px-5 sm:px-8 lg:px-12 pt-24 sm:pt-28 pb-10 sm:pb-14">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white font-serif tracking-tight leading-[1.1] drop-shadow-lg">
                {event.name}
              </h1>
              {event.tagline && (
                <p className="mt-2.5 text-base sm:text-lg lg:text-xl text-zinc-300 italic leading-relaxed max-w-2xl">
                  {event.tagline}
                </p>
              )}

              {/* Quick-info pills */}
              <div className="mt-6 flex flex-wrap gap-2.5">
                {event.start_time_date && (
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-white/90 font-medium">
                    <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    {formatEventDate(event.start_time_date)}
                  </span>
                )}
                {event.doors_open && (
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-white/90 font-medium">
                    <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 4h3a2 2 0 0 1 2 2v14" />
                      <path d="M2 20h3" />
                      <path d="M13 20h9" />
                      <path d="M10 12v.01" />
                      <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4.742-1.186A1 1 0 0 1 13 4.56z" />
                    </svg>
                    Doors open at {formatTime(event.doors_open)}
                  </span>
                )}
                {event.start_time_date && (
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-white/90 font-medium">
                    <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Doors close at {formatTime(event.start_time_date)}
                  </span>
                )}
                {event.venue && (
                  event.venue_link ? (
                    <a
                      href={event.venue_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-white/90 font-medium transition-colors hover:bg-white/[0.14]"
                    >
                      <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      {event.venue}
                      <svg className="w-3 h-3 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                      </svg>
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-white/90 font-medium">
                      <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      {event.venue}
                    </span>
                  )
                )}
              </div>
            </div>
          </section>

          {/* ─── Content section on solid background ─── */}
          <main className="w-full max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 pb-12 lg:pb-16">
            <div className="lg:grid lg:grid-cols-2 lg:gap-8 flex flex-col gap-6">
              {/* Left column – event details */}
              <div className="flex flex-col gap-5">
                {/* Prohibited items */}
                {(hasTicket || (ticketStatus && ticketStatus.status === "WAITLISTED")) && (
                  <div className="rounded-xl bg-amber-950/30 border border-amber-500/20 p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-amber-200 mb-2.5 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      Prohibited Items
                    </h3>
                    <ul className="text-sm text-amber-100/80 space-y-1.5 list-disc list-inside ml-1">
                      <li>No bags, including purses</li>
                      <li>No water bottles</li>
                    </ul>
                  </div>
                )}

                {/* Description */}
                {event.desc && (
                  <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/70 p-5 sm:p-6">
                    <p className="text-sm sm:text-[15px] text-zinc-300 leading-[1.75]">
                      {event.desc}
                    </p>
                  </div>
                )}

                {/* Add to Google Calendar */}
                {calendarUrl && (
                  <a
                    href={calendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/70 px-5 py-3.5 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-800/60 hover:text-white hover:border-zinc-700 active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    Add to Google Calendar
                  </a>
                )}
              </div>

              {/* Right column – ticket section (sticky on desktop) */}
              <div>
                <div className="lg:sticky lg:top-24 flex flex-col gap-5">
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
            </div>

            {/* ADA notice */}
            <div className="mt-10 pt-6 border-t border-zinc-800/50">
              <p className="text-center text-xs sm:text-sm text-zinc-500 leading-relaxed">
                For ADA accommodations, please email{" "}
                <a
                  href="mailto:tickets@stanfordspeakersbureau.com"
                  className="text-zinc-400 underline underline-offset-2 decoration-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  tickets@stanfordspeakersbureau.com
                </a>
              </p>
            </div>
          </main>
        </>
      </WaitForImages>
    </div>
  );
}
