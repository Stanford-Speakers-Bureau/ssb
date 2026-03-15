import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  getEventByRoute,
  isEventMystery,
  getImageProxyUrl,
  createServerSupabaseClient,
  isEventUnderCapacity,
} from "@/app/lib/supabase";
import { db, eq, and, tickets, waitlist, notify } from "@ssb/db";
import { generateGoogleCalendarUrl } from "@/app/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import TicketSection from "./TicketSection";
import ProhibitedItems from "./ProhibitedItems";
import HeroSection from "./HeroSection";
import LivestreamBanner from "./LivestreamBanner";
import { NoticeBanner } from "./ui";

interface PageProps {
  params: Promise<{ eventID: string }>;
}

const getCachedEvent = cache(getEventByRoute);

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

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

      <HeroSection
        name={event.name}
        tagline={event.tagline}
        signedImageUrl={signedImageUrl}
        startTimeDate={event.start_time_date}
        doorsOpen={event.doors_open}
        venue={event.venue}
        venueLink={event.venue_link}
      />

      {/* ─── Content section on solid background ─── */}
      <main className="w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pb-12 lg:pb-16">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 flex flex-col-reverse gap-6">
          {/* Left column – event details */}
          <div className="flex flex-col gap-5">

            {/* Description */}
            {event.desc && (
              <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/70 p-5 sm:p-6">
                <div className="prose prose-sm prose-zinc dark:prose-invert prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-p:leading-[1.75] prose-a:text-red-600 dark:prose-a:text-red-400 prose-a:underline prose-a:underline-offset-2 max-w-none">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>{event.desc}</ReactMarkdown>
                </div>
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
            <ProhibitedItems />
          </div>

          {/* Right column – ticket section (sticky on desktop) */}
          <div>
            <div className="lg:sticky lg:top-24 flex flex-col gap-5">
              {/* Livestream banner */}
              {event.livestream && (
                <LivestreamBanner
                  livestreamUrl={event.livestream}
                  eventStartTime={event.start_time_date}
                />
              )}

              {event.priority && (
                <NoticeBanner
                  color="blue"
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>}
                >
                  <div className="prose prose-sm prose-blue dark:prose-invert prose-p:m-0 prose-a:underline max-w-none">
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>{event.priority}</ReactMarkdown>
                  </div>
                </NoticeBanner>
              )}

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
                hideTicketingDate={event.hide_ticketing_date}
                initialIsNotified={isNotified}
                waitlistChance={event.waitlist_chance}
                priorityText={event.priority}
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
