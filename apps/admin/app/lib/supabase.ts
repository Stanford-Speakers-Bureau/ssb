import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { db, events } from "@ssb/db";
import type { InferSelectModel } from "@ssb/db";
import {
  getTicketCounts as _getTicketCounts,
  getAvailablePublicTickets as _getAvailablePublicTickets,
  isEventUnderCapacity as _isEventUnderCapacity,
} from "@ssb/db/queries";
import { generateReferralCode } from "./utils";
import { resolveTicketingRoles, type TicketingRole } from "./ticketingRoles";

type DBEvent = InferSelectModel<typeof events>;

/**
 * Serialized event type used across the admin app.
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
  live?: boolean;
  latitude?: number;
  longitude?: number;
  address?: string;
  waitlist_chance?: string | null;
  standby_enabled?: boolean | null;
  livestream?: string | null;
  priority?: string | null;
  hide_ticketing_date?: boolean;
  referrals_enabled?: boolean;
  ticketing_roles?: TicketingRole[];
  external_ticketing_enabled?: boolean;
  external_ticketing_url?: string | null;
  banner_eligible?: boolean;
  identity_verification_enabled?: boolean;
  allow_admitting_standby?: boolean;
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
    live: e.live,
    latitude: Number(e.latitude),
    longitude: Number(e.longitude),
    address: e.address,
    waitlist_chance: e.waitlistChance ?? null,
    standby_enabled: e.standbyEnabled ?? null,
    livestream: e.livestream ?? null,
    priority: e.priority ?? null,
    ticketing_roles: resolveTicketingRoles(e.ticketingRoles),
    hide_ticketing_date: e.hideTicketingDate ?? false,
    referrals_enabled: e.referralsEnabled ?? false,
    external_ticketing_enabled: e.externalTicketingEnabled ?? false,
    external_ticketing_url: e.externalTicketingUrl ?? null,
    banner_eligible: e.bannerEligible ?? true,
    identity_verification_enabled: e.identityVerificationEnabled ?? true,
    allow_admitting_standby: e.allowAdmittingStandby ?? false,
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

/**
 * Generate a referral code from a user's email address.
 * Re-exported from utils.ts for backward compatibility.
 * @deprecated Import from "./utils" instead for use in Client Components.
 */
export { generateReferralCode };

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
