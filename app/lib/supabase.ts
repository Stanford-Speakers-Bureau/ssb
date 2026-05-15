import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { db, eq, gte, and, events, referrals, sql } from "@ssb/db";
import type { InferSelectModel } from "@ssb/db";
import {
  getTicketCounts as _getTicketCounts,
  getAvailablePublicTickets as _getAvailablePublicTickets,
  isEventUnderCapacity as _isEventUnderCapacity,
  getUserWaitlistStatus as _getUserWaitlistStatus,
  getWaitlistCount as _getWaitlistCount,
} from "@ssb/db/queries";
import { generateReferralCode } from "./utils";
import { resolveTicketingRoles } from "./ticketingRoles";

type DBEvent = InferSelectModel<typeof events>;

/**
 * Serialized event type used across the app.
 * Maps from DB Event (camelCase) to the snake_case string/number format the UI expects.
 */
export type Event = {
  id: string;
  created_at: string;
  name: string | null;
  desc: string | null;
  tagline: string | null;
  img: string | null;
  mobile_img: string | null;
  apple_wallet_img: string | null;
  capacity: number;
  tickets?: number | null;
  venue: string | null;
  reserved: number | null;
  venue_link: string | null;
  release_date: string | null;
  ticketing_date?: string | null;
  start_time_date: string | null;
  end_time_date: string | null;
  doors_open: string | null;
  route: string | null;
  img_version?: number | null;
  waitlist_chance?: string | null;
  livestream?: string | null;
  priority?: string | null;
  hide_ticketing_date?: boolean;
  referrals_enabled?: boolean;
  standby_enabled?: boolean;
  ticketing_roles?: string[];
  external_ticketing_enabled?: boolean;
  external_ticketing_url?: string | null;
  banner_eligible?: boolean;
};

/**
 * Convert a DB Event to the serialized Event type used by the UI.
 */
export function serializeEvent(e: DBEvent): Event {
  return {
    id: e.id,
    created_at: e.createdAt.toISOString(),
    name: e.name,
    desc: e.desc,
    tagline: e.tagline,
    img: e.img,
    mobile_img: e.mobileImg,
    apple_wallet_img: e.appleWalletImg,
    capacity: e.capacity,
    tickets: e.tickets,
    venue: e.venue,
    reserved: e.reserved,
    venue_link: e.venueLink,
    release_date: e.releaseDate?.toISOString() ?? null,
    ticketing_date: e.ticketingDate?.toISOString() ?? null,
    start_time_date: e.startTimeDate?.toISOString() ?? null,
    end_time_date: e.endTimeDate?.toISOString() ?? null,
    doors_open: e.doorsOpen?.toISOString() ?? null,
    route: e.route,
    img_version: e.imgVersion,
    waitlist_chance: e.waitlistChance ?? null,
    livestream: e.livestream ?? null,
    priority: e.priority ?? null,
    ticketing_roles: resolveTicketingRoles(e.ticketingRoles),
    hide_ticketing_date: e.hideTicketingDate ?? false,
    referrals_enabled: e.referralsEnabled ?? false,
    standby_enabled: e.standbyEnabled ?? false,
    external_ticketing_enabled: e.externalTicketingEnabled ?? false,
    external_ticketing_url: e.externalTicketingUrl ?? null,
    banner_eligible: e.bannerEligible ?? true,
  };
}

/**
 * Supabase client for Auth and Storage operations only.
 * Database queries use Drizzle via @ssb/db.
 */
export function getSupabaseClient() {
  return createSupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
  );
}

/**
 * Get the closest upcoming event for the banner
 */
const getCachedClosestUpcomingEvent = unstable_cache(
  async (): Promise<Event | null> => {
    const event = await db.query.events.findFirst({
      where: gte(events.doorsOpen, new Date()),
      orderBy: (events, { asc }) => [asc(events.doorsOpen)],
    });

    if (!event) return null;
    return serializeEvent(event);
  },
  ["closest-upcoming-event"],
  { revalidate: 60 },
);

export async function getClosestUpcomingEvent(): Promise<Event | null> {
  return getCachedClosestUpcomingEvent();
}

/**
 * SQL fragment for "the event is still alive": within 6h of its effective
 * end. Effective end = end_time_date if set, otherwise start_time_date + 12h.
 * Use this anywhere the banner/popup or upcoming-speakers grid wants to keep
 * an event visible through doors and the immediate post-event window before
 * rotating to the next one.
 */
export const EVENT_STILL_ALIVE = sql`
  COALESCE(
    ${events.endTimeDate},
    ${events.startTimeDate} + INTERVAL '12 hours'
  ) + INTERVAL '6 hours' > NOW()
`;

/**
 * Get the next event to surface in the banner/popup — the one whose
 * doors_open is soonest. The banner-data API then picks the appropriate
 * phase (mystery → pre-ticketing → ticketing-open) for that event.
 *
 * Events stay in the running until 6 hours past their effective end time
 * (end_time_date, or start_time_date + 12h when end is missing). When
 * multiple events are simultaneously active (doors already open, not yet
 * timed out), we surface whichever opened most recently — that's the one
 * the audience is at right now.
 */
const getCachedNextMilestoneEvent = unstable_cache(
  async (): Promise<Event | null> => {
    const now = new Date();
    const alive = await db.query.events.findMany({
      where: and(EVENT_STILL_ALIVE, eq(events.bannerEligible, true)),
      orderBy: (events, { asc }) => [asc(events.doorsOpen)],
    });

    if (alive.length === 0) return null;

    const active = alive.filter(
      (e) => e.doorsOpen && e.doorsOpen <= now,
    );
    if (active.length > 0) {
      const event = active.reduce((best, cur) => {
        const curT = cur.doorsOpen!.getTime();
        const bestT = best.doorsOpen!.getTime();
        return curT > bestT ? cur : best;
      });
      return serializeEvent(event);
    }

    // Pick by doors_open only. Don't leapfrog priority based on a later
    // event's release_date or ticketing_date being sooner than this event's
    // doors_open — that surfaces event B's reveal countdown while event A
    // is the one actually happening next.
    const doorsTime = (e: DBEvent): number =>
      e.doorsOpen?.getTime() ?? Number.POSITIVE_INFINITY;

    const event = alive.reduce((best, cur) =>
      doorsTime(cur) < doorsTime(best) ? cur : best,
    );
    return serializeEvent(event);
  },
  ["next-milestone-event"],
  { revalidate: 60 },
);

export async function getNextMilestoneEvent(): Promise<Event | null> {
  return getCachedNextMilestoneEvent();
}

/**
 * Generate a signed URL for a speaker image from Supabase storage
 */
export async function getSignedImageUrl(
  imgName: string | null,
  expiresIn: number = 60,
): Promise<string | null> {
  if (!imgName) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from("speakers")
    .createSignedUrl(imgName, expiresIn);

  if (error) {
    return null;
  }

  return data?.signedUrl || null;
}

// Timezone for event display (Pacific Time for Stanford)
const EVENT_TIMEZONE = "America/Los_Angeles";

/**
 * Format a date for display (e.g., "January 23rd, 2026")
 */
export function formatEventDate(dateString: string | null): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: EVENT_TIMEZONE,
  }).formatToParts(date);

  return parts
    .map((part) => {
      if (part.type !== "day") {
        return part.value;
      }

      const day = Number(part.value);
      return Number.isNaN(day) ? part.value : `${day}${getOrdinalSuffix(day)}`;
    })
    .join("");
}

/**
 * Format time for display (e.g., "7:30 PM")
 */
export function formatTime(dateString: string | null): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: EVENT_TIMEZONE,
  });
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * Check if an event is still a mystery (not yet revealed)
 */
export function isEventMystery(event: {
  release_date: string | null;
  name: string | null;
}): boolean {
  if (process.env.LOCAL_EVENTS_ENABLED === "true") {
    return false;
  }
  const now = new Date();
  const releaseDateStr = event.release_date;
  if (releaseDateStr == null) {
    return !event.name;
  }
  const releaseDate = new Date(releaseDateStr as string);
  return now < releaseDate;
}

/**
 * Get an event by its route slug
 */
export async function getEventByRoute(route: string): Promise<Event | null> {
  const event = await db.query.events.findFirst({
    where: eq(events.route, route),
  });

  if (!event) return null;
  return serializeEvent(event);
}

/**
 * Get an event by its ID
 */
export async function getEventById(id: string): Promise<Event | null> {
  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });

  if (!event) return null;
  return serializeEvent(event);
}

/**
 * Generate a proxy URL for an event image
 * Uses img_version for cache-busting
 */
export function getImageProxyUrl(
  eventId: string,
  imgVersion?: number | null,
  variant: "default" | "mobile" = "default",
): string {
  const version = imgVersion || 1;
  const searchParams = new URLSearchParams({ v: version.toString() });
  if (variant === "mobile") {
    searchParams.set("variant", "mobile");
  }
  return `/api/images/${eventId}?${searchParams.toString()}`;
}

/**
 * Generate a referral code from a user's email address.
 * Re-exported from utils.ts for backward compatibility.
 * @deprecated Import from "./utils" instead for use in Client Components.
 */
export { generateReferralCode };

/**
 * Update referral records when a ticket is created.
 * Ensures a referral record exists for the user's referral code.
 */
export async function updateReferralRecords(
  eventId: string,
  userEmail: string,
): Promise<void> {
  try {
    const userReferralCode = generateReferralCode(userEmail);

    if (userReferralCode) {
      await db
        .insert(referrals)
        .values({
          eventId,
          referralCode: userReferralCode,
          count: 0,
        })
        .onConflictDoNothing();
    }
  } catch (error) {
    console.error("Error updating referral records:", error);
  }
}

// Re-export shared query helpers from @ssb/db, bound to the singleton db client
export async function getTicketCounts(eventId: string) {
  return _getTicketCounts(db, eventId);
}

export async function getAvailablePublicTickets(eventId: string) {
  return _getAvailablePublicTickets(db, eventId);
}

export async function isEventUnderCapacity(eventId: string) {
  return _isEventUnderCapacity(db, eventId);
}

export async function getUserWaitlistStatus(
  eventId: string,
  userEmail: string,
) {
  return _getUserWaitlistStatus(db, eventId, userEmail);
}

export async function getWaitlistCount(eventId: string) {
  return _getWaitlistCount(db, eventId);
}
