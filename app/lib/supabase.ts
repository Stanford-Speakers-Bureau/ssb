import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { db, eq, and, gte, events, roles, referrals } from "@ssb/db";
import type { InferSelectModel } from "@ssb/db";
import {
  getTicketCounts as _getTicketCounts,
  getAvailablePublicTickets as _getAvailablePublicTickets,
  isEventUnderCapacity as _isEventUnderCapacity,
  getUserWaitlistStatus as _getUserWaitlistStatus,
  getWaitlistCount as _getWaitlistCount,
} from "@ssb/db/queries";
import { generateReferralCode } from "./utils";

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
  capacity: number;
  tickets?: number | null;
  venue: string | null;
  reserved: number | null;
  venue_link: string | null;
  release_date: string | null;
  ticketing_date?: string | null;
  banner: boolean | null;
  start_time_date: string | null;
  doors_open: string | null;
  route: string | null;
  img_version?: number | null;
  waitlist_chance?: string | null;
  livestream?: boolean | null;
  waitlist_mode?: boolean | null;
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
    capacity: e.capacity,
    tickets: e.tickets,
    venue: e.venue,
    reserved: e.reserved,
    venue_link: e.venueLink,
    release_date: e.releaseDate?.toISOString() ?? null,
    ticketing_date: e.ticketingDate?.toISOString() ?? null,
    banner: e.banner,
    start_time_date: e.startTimeDate?.toISOString() ?? null,
    doors_open: e.doorsOpen?.toISOString() ?? null,
    route: e.route,
    img_version: e.imgVersion,
    waitlist_chance: e.waitlistChance ?? null,
    livestream: e.livestream ?? null,
    waitlist_mode: e.waitlistMode ?? false,
  };
}

type UnauthorizedResult = {
  authorized: false;
  error: string;
};

type AuthorizedResult = {
  authorized: true;
  email: string;
  adminClient: ReturnType<typeof getSupabaseClient>;
};

export type AdminVerificationResult = UnauthorizedResult | AuthorizedResult;

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
 * Verify that the current request is authenticated and belongs to either an admin or scanner user.
 * Returns the admin client for privileged database access when authorized.
 */
export async function verifyAdminOrScannerRequest(): Promise<AdminVerificationResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return { authorized: false, error: "Not authenticated" };
  }

  const roleRecord = await db.query.roles.findFirst({
    where: eq(roles.email, user.email),
    columns: { roles: true },
  });

  if (!roleRecord) {
    return { authorized: false, error: "Not authorized" };
  }

  const userRoles = roleRecord.roles?.split(",") || [];
  const isAdmin = userRoles.includes("admin");
  const isScanner = userRoles.includes("scanner");

  if (!isAdmin && !isScanner) {
    return { authorized: false, error: "Not authorized" };
  }

  const adminClient = getSupabaseClient();
  return { authorized: true, email: user.email, adminClient };
}

/**
 * Create a Supabase client for use on the server (server components, API routes)
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Ignore - called from Server Component
          }
        },
      },
    },
  );
}

/**
 * Get the closest upcoming event for the banner
 */
export async function getClosestUpcomingEvent(): Promise<Event | null> {
  const event = await db.query.events.findFirst({
    where: gte(events.doorsOpen, new Date()),
    orderBy: (events, { asc }) => [asc(events.doorsOpen)],
  });

  if (!event) return null;
  return serializeEvent(event);
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
  const day = parseInt(
    date.toLocaleDateString("en-US", {
      day: "numeric",
      timeZone: EVENT_TIMEZONE,
    }),
  );
  const suffix = getOrdinalSuffix(day);

  return date
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: EVENT_TIMEZONE,
    })
    .replace(/\d+/, `${day}${suffix}`);
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
): string {
  const version = imgVersion || 1;
  return `/api/images/${eventId}?v=${version}`;
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
      await db.insert(referrals)
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

export async function getUserWaitlistStatus(eventId: string, userEmail: string) {
  return _getUserWaitlistStatus(db, eventId, userEmail);
}

export async function getWaitlistCount(eventId: string) {
  return _getWaitlistCount(db, eventId);
}

/**
 * Check if waitlist is closed (within 2 hours of event start time).
 * When closed, joining the waitlist will issue a WAITLIST ticket instead.
 */
export function isWaitlistClosed(eventStartTime: string | null): boolean {
  if (!eventStartTime) return false;

  const twoHoursBeforeStart =
    new Date(eventStartTime).getTime() - 2 * 60 * 60 * 1000;
  return Date.now() >= twoHoursBeforeStart;
}
