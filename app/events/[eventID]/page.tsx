import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { cache } from "react";
import {
  getEventByRoute,
  isEventMystery,
  getImageProxyUrl,
  formatEventDate,
  formatTime,
  createServerSupabaseClient,
  isEventUnderCapacity,
} from "@/app/lib/supabase";
import { db, eq, and, tickets, waitlist, notify } from "@ssb/db";
import { generateGoogleCalendarUrl } from "@/app/lib/utils";
import TicketSection from "./TicketSection";
import ProhibitedItems from "./ProhibitedItems";

interface PageProps {
  params: Promise<{ eventID: string }>;
}

const getCachedEvent = cache(getEventByRoute);

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

function getTimeUntil(dateString: string): string | null {
  const now = Date.now();
  const target = new Date(dateString).getTime();
  const diff = target - now;
  if (diff <= 0) return null;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days} day${days === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  if (minutes > 0) return `${minutes} min`;
  return null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { eventID } = await params;
  const event = await getCachedEvent(eventID);

  if (!event || isEventMystery(event)) {
    return {
      title: "Event",
      description: "View event details and get tickets from Stanford Speakers Bureau.",
    };
  }

  const description = event.desc || event.tagline || "Get tickets for this Stanford Speakers Bureau event.";
  const imageUrl = event.img ? getImageProxyUrl(event.id, event.img_version) : undefined;

  return {
    title: event.name,
    description,
    openGraph: {
      title: event.name || "Event",
      description,
      ...(imageUrl && {
        images: [{ url: imageUrl }],
      }),
    },
  };
}

async function getUserTicketStatus(eventId: string): Promise<{
  ticketId: string | null;
  userEmail: string | null;
  ticketType: string | null;
  ticketName: string | null;
  isOnWaitlist: boolean;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email)
      return { ticketId: null, userEmail: null, ticketType: null, ticketName: null, isOnWaitlist: false };

    const [ticket, waitlistEntry] = await Promise.all([
      db.query.tickets.findFirst({
        where: and(eq(tickets.eventId, eventId), eq(tickets.email, user.email)),
        columns: { id: true, type: true, name: true },
      }),
      db.query.waitlist.findFirst({
        where: and(eq(waitlist.eventId, eventId), eq(waitlist.email, user.email)),
        columns: { id: true },
      }),
    ]);

    return {
      ticketId: ticket?.id ?? null,
      userEmail: user.email,
      ticketType: ticket?.type ?? null,
      ticketName: ticket?.name ?? null,
      isOnWaitlist: !!waitlistEntry,
    };
  } catch {
    return { ticketId: null, userEmail: null, ticketType: null, ticketName: null, isOnWaitlist: false };
  }
}

async function getUserNotificationStatus(eventId: string): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return false;

    const entry = await db.query.notify.findFirst({
      where: and(eq(notify.email, user.email), eq(notify.speakerId, eventId)),
      columns: { id: true },
    });

    return !!entry;
  } catch {
    return false;
  }
}

export default async function EventPage({ params }: PageProps) {
  const { eventID } = await params;

  const event = await getCachedEvent(eventID);

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
  const showProhibitedItems = Boolean(hasTicket || ticketStatus.isOnWaitlist || (event.start_time_date && new Date(event.start_time_date) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)));

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

  // Build JSON-LD structured data for the event
  const jsonLd = !isEventMystery(event)
    ? {
      "@context": "https://schema.org",
      "@type": "Event",
      name: event.name,
      ...(event.desc && { description: event.desc }),
      ...(event.start_time_date && { startDate: event.start_time_date }),
      ...(event.start_time_date && {
        endDate: new Date(new Date(event.start_time_date).getTime() + 2 * 60 * 60 * 1000).toISOString(),
      }),
      ...(event.doors_open && { doorTime: event.doors_open }),
      location: {
        "@type": "Place",
        name: event.venue || "Stanford University",
        ...(event.venue_link && { url: event.venue_link }),
        address: {
          "@type": "PostalAddress",
          streetAddress: "450 Serra Mall",
          addressLocality: "Stanford",
          addressRegion: "CA",
          postalCode: "94305",
          addressCountry: "US",
        },
      },
      ...(signedImageUrl && { image: `${baseURL}${signedImageUrl}` }),
      url: `${baseURL}/events/${event.route || eventID}`,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      isAccessibleForFree: true,
      performer: {
        "@type": "Person",
        name: event.name,
      },
      organizer: {
        "@type": "Organization",
        name: "Stanford Speakers Bureau",
        url: baseURL,
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: isSoldOut
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
        validFrom: event.ticketing_date || event.release_date || event.start_time_date || new Date().toISOString(),
        url: `${baseURL}/events/${event.route || eventID}`,
      },
    }
    : null;

  return (
    <div className="relative flex flex-col font-sans min-h-screen bg-white dark:bg-zinc-950">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* ─── Hero section with contained image ─── */}
      <section className="relative w-full overflow-hidden">
        {/* Speaker image – contained to hero only */}
        {signedImageUrl && (
          <div className="relative aspect-[3/2] sm:absolute sm:inset-0 sm:aspect-auto bg-zinc-200 dark:bg-zinc-800">
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
            {/* Top fade for nav contrast */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(9,9,11,0.85) 0%, rgba(9,9,11,0.1) 25%, transparent 50%)",
              }}
            />
          </div>
        )}

        {/* Bottom fade into page background — light */}
        <div
          className="absolute inset-0 hidden sm:block dark:hidden"
          style={{
            background:
              "linear-gradient(to top, rgb(255,255,255) 0%, rgba(255,255,255,0.85) 30%, rgba(255,255,255,0.35) 60%, rgba(255,255,255,0.25) 100%)",
          }}
        />
        {/* Bottom fade into page background — dark */}
        <div
          className="absolute inset-0 hidden sm:dark:block"
          style={{
            background:
              "linear-gradient(to top, rgb(9,9,11) 0%, rgba(9,9,11,0.85) 30%, rgba(9,9,11,0.35) 60%, rgba(9,9,11,0.25) 100%)",
          }}
        />

        {/* Hero content – anchored bottom-left */}
        <div className="relative z-10 flex flex-col sm:justify-end sm:min-h-[78vh] lg:min-h-[85vh] max-w-6xl mx-auto w-full px-5 sm:px-8 lg:px-12 pt-5 sm:pt-28 pb-6 sm:pb-14">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-zinc-900 dark:text-white font-serif tracking-tight leading-tight sm:leading-[1.1] dark:drop-shadow-lg">
            {event.name}
          </h1>
          {event.tagline && (
            <p className="mt-1.5 sm:mt-2.5 text-sm sm:text-lg lg:text-xl text-zinc-600 dark:text-zinc-300 italic leading-relaxed max-w-6xl">
              {event.tagline}
            </p>
          )}

          {/* Quick-info pills */}
          <div className="mt-3 sm:mt-6 flex flex-wrap gap-2 sm:gap-2.5">
            {event.start_time_date && (
              <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] backdrop-blur-md border border-black/[0.1] dark:border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-zinc-900/90 dark:text-white/90 font-medium">
                <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                {formatEventDate(event.start_time_date)}
              </span>
            )}
            {event.doors_open && (
              <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] backdrop-blur-md border border-black/[0.1] dark:border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-zinc-900/90 dark:text-white/90 font-medium">
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
              <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] backdrop-blur-md border border-black/[0.1] dark:border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-zinc-900/90 dark:text-white/90 font-medium">
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
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] backdrop-blur-md border border-black/[0.1] dark:border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-zinc-900/90 dark:text-white/90 font-medium transition-colors hover:bg-black/[0.1] dark:hover:bg-white/[0.14]"
                >
                  <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  {event.venue}
                  <svg className="w-3 h-3 text-zinc-500 dark:text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] backdrop-blur-md border border-black/[0.1] dark:border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-zinc-900/90 dark:text-white/90 font-medium">
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
      <main className="w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pb-12 lg:pb-16">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 flex flex-col-reverse gap-6">
          {/* Left column – event details */}
          <div className="flex flex-col gap-5">

            {/* Description */}
            {event.desc && (
              <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/70 p-5 sm:p-6">
                <p className="text-sm sm:text-[15px] text-zinc-700 dark:text-zinc-300 leading-[1.75]">
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
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/70 px-5 py-3.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 active:scale-[0.98]"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                Add to Google Calendar
              </a>
            )}
            {/* Prohibited items */}
            <ProhibitedItems initialShow={showProhibitedItems} />
          </div>

          {/* Right column – ticket section (sticky on desktop) */}
          <div>
            <div className="lg:sticky lg:top-24 flex flex-col gap-5">
              {/* Livestream banner */}
              {event.livestream && (() => {
                const showLinks = event.start_time_date && (new Date(event.start_time_date).getTime() - Date.now()) <= 2 * 60 * 60 * 1000;
                return showLinks ? (
                  <div className="relative rounded-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600 via-purple-600 to-orange-500" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400/20 via-transparent to-purple-500/30" />
                    <div className="relative px-5 py-4 sm:py-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-300" />
                          </span>
                          Live
                        </span>
                        <p className="text-sm sm:text-base font-bold text-white leading-snug">
                          Watch the livestream
                        </p>
                      </div>
                      <div className="flex gap-2.5">
                        <a
                          href="https://www.youtube.com/@StanfordSpeakersBureau/live"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex-1 flex items-center gap-3 rounded-lg bg-white/15 backdrop-blur-sm ring-1 ring-white/20 px-4 py-3 transition-all hover:bg-white/25"
                        >
                          <svg className="w-6 h-6 text-white flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                          </svg>
                          <span className="text-sm font-semibold text-white">YouTube</span>
                          <svg className="w-4 h-4 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all ml-auto flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600 via-purple-600 to-orange-500" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400/20 via-transparent to-purple-500/30" />
                    <div className="relative px-5 py-4 sm:py-5 flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/25">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-bold text-white leading-snug">
                          This event will be livestreamed to the public!
                          {event.start_time_date && getTimeUntil(event.start_time_date) && (
                            <span className="font-normal text-white/80">
                              {" "}in {getTimeUntil(event.start_time_date)}
                            </span>
                          )}
                        </p>
                        <p className="text-xs sm:text-sm text-white/75 mt-0.5">
                          A link will be available closer to the event
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                ticketingDate={process.env.LOCAL_TICKETING_ENABLED === "true" ? null : (event.ticketing_date ?? event.release_date)}
                initialIsNotified={isNotified}
                waitlistChance={event.waitlist_chance}
              />
            </div>
          </div>
        </div>

        {/* ADA notice */}
        <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800/50">
          <p className="text-center text-xs sm:text-sm text-zinc-500 leading-relaxed">
            For ADA accommodations or other questions, please email{" "}
            <a
              href="mailto:tickets@stanfordspeakersbureau.com"
              className="text-zinc-600 dark:text-zinc-400 underline underline-offset-2 decoration-zinc-300 dark:decoration-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
            >
              tickets@stanfordspeakersbureau.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
