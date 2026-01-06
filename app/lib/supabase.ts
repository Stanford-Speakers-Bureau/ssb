import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateReferralCode } from "./utils";

/**
 * Simple Supabase client for public data queries (bypasses RLS with service key)
 */
export function getSupabaseClient() {
  return createSupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
  );
}

export type Event = {
  id: string;
  created_at: string;
  name: string | null;
  desc: string | null;
  tagline: string | null;
  img: string | null;
  capacity: number;
  /**
   * Number of tickets sold so far.
   * (Newer schema field; fall back to `reserved` in older rows/clients.)
   */
  tickets?: number | null;
  venue: string | null;
  reserved: number | null;
  venue_link: string | null;
  release_date: string | null;
  banner: boolean | null;
  start_time_date: string | null;
  doors_open: string | null;
  route: string | null;
  img_version?: number | null;
};

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

  const adminClient = getSupabaseClient();
  const { data: roleRecord } = await adminClient
    .from("roles")
    .select("roles")
    .eq("email", user.email)
    .single();

  if (!roleRecord) {
    return { authorized: false, error: "Not authorized" };
  }

  const roles = roleRecord.roles?.split(",") || [];
  const isAdmin = roles.includes("admin");
  const isScanner = roles.includes("scanner");

  if (!isAdmin && !isScanner) {
    return { authorized: false, error: "Not authorized" };
  }

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
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("doors_open", new Date().toISOString())
    .order("doors_open", { ascending: true })
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data;
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
 * An event is a mystery if:
 * - There's a release_date and we're before that date, OR
 * - There's no release_date and no name
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
  // TypeScript should narrow here, but if not, we explicitly assert
  const releaseDate = new Date(releaseDateStr as string);
  return now < releaseDate;
}

/**
 * Get an event by its route slug
 */
export async function getEventByRoute(route: string): Promise<Event | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("route", route)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Get an event by its ID
 */
export async function getEventById(id: string): Promise<Event | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
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
 *
 * This function is non-blocking and logs errors without throwing.
 */
export async function updateReferralRecords(
  eventId: string,
  userEmail: string,
): Promise<void> {
  try {
    const adminClient = getSupabaseClient();
    const userReferralCode = generateReferralCode(userEmail);

    // Ensure the current user has a referral record for this event (for sharing)
    if (userReferralCode) {
      const { data: userReferral } = await adminClient
        .from("referrals")
        .select("id")
        .eq("event_id", eventId)
        .eq("referral_code", userReferralCode)
        .single();

      if (!userReferral) {
        // Create referral record for the user
        const { error: insertError } = await adminClient
          .from("referrals")
          .insert({
            event_id: eventId,
            referral_code: userReferralCode,
            count: 0,
          });

        if (insertError) {
          console.error("Error creating user referral record:", insertError);
        }
      }
    }
  } catch (error) {
    console.error("Error updating referral records:", error);
    // Don't throw - this is a non-critical operation
  }
}
