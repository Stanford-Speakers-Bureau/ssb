import { NextRequest } from "next/server";
import { db, eq, events, tickets, walletVoidedPasses } from "@ssb/db";
import { getSignedImageUrl } from "@/app/lib/supabase";
import { fetchWithTimeout } from "@/app/lib/fetch";
import { getAppleWalletPass } from "@/app/lib/wallet";
import { verifyAppleWalletAuthToken } from "@/app/lib/wallet-links";

const IMG_FETCH_TIMEOUT_MS = 10_000;

export const WALLET_PASS_TYPE_ID = "pass.com.stanfordspeakersbureau.ticket";

export type BuiltPass = {
  buffer: Buffer;
  lastModified: Date;
};

// The event fields the pass renders from. Shared by the live and voided paths.
const EVENT_PASS_COLUMNS = {
  name: true,
  doorsOpen: true,
  startTimeDate: true,
  venue: true,
  img: true,
  appleWalletImg: true,
  venueLink: true,
  route: true,
  latitude: true,
  longitude: true,
  address: true,
  allowAdmittingStandby: true,
} as const;

type EventPassFields = {
  name: string | null;
  doorsOpen: Date | null;
  startTimeDate: Date | null;
  venue: string | null;
  img: string | null;
  appleWalletImg: string | null;
  venueLink: string | null;
  route: string | null;
  latitude: string;
  longitude: string;
  address: string;
  allowAdmittingStandby: boolean;
};

/**
 * Verifies the `Authorization: ApplePass <token>` header a device sends on
 * web-service calls. The token is the per-pass authenticationToken, derived
 * from the serial number (ticket id). Returns true only on an exact match.
 */
export async function verifyApplePassAuth(
  req: NextRequest,
  serialNumber: string,
): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^ApplePass\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  return verifyAppleWalletAuthToken(serialNumber, match[1]);
}

// Fetches the event strip image and builds the .pkpass. `cancelled` flips the
// pass to a voided "CANCELLED" state. Returns null if the image can't be loaded.
async function renderPass(args: {
  ticketId: string;
  email: string;
  name: string | null;
  ticketType: string;
  event: EventPassFields;
  cancelled: boolean;
  checkedIn: boolean;
}): Promise<Buffer | null> {
  const { event } = args;
  const imgUrl = await getSignedImageUrl(
    event.appleWalletImg || event.img,
    3600,
  );
  if (!imgUrl) return null;

  const imgResponse = await fetchWithTimeout(imgUrl, {}, IMG_FETCH_TIMEOUT_MS);
  if (!imgResponse.ok) return null;
  const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

  const buffer = await getAppleWalletPass(imgBuffer, {
    email: args.email,
    name: args.name,
    eventName: event.name ?? "",
    ticketType: args.ticketType,
    eventDoorTime: event.doorsOpen?.toISOString() ?? "",
    ticketId: args.ticketId,
    eventVenue: event.venue ?? "",
    eventVenueLink: event.venueLink ?? "",
    eventLink: `${process.env.NEXT_PUBLIC_BASE_URL}/events/${event.route}`,
    eventLat: Number(event.latitude),
    eventLng: Number(event.longitude),
    eventAddress: event.address ?? "",
    start_time_date: event.startTimeDate?.toISOString() ?? "",
    cancelled: args.cancelled,
    checkedIn: args.checkedIn,
    admittingStandby: event.allowAdmittingStandby,
  });
  return (buffer as Buffer) ?? null;
}

/**
 * Builds the current `.pkpass` for a serial (ticket id). The caller must have
 * already authorized via verifyApplePassAuth.
 *
 * - Live ticket → its normal pass.
 * - Cancelled (hard-deleted) ticket with a tombstone → a voided pass rendered
 *   from the still-existing event row.
 * - Otherwise → null (404).
 */
export async function buildApplePassForTicket(
  ticketId: string,
): Promise<BuiltPass | null> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      id: true,
      email: true,
      name: true,
      type: true,
      scanned: true,
      walletUpdatedAt: true,
      createdAt: true,
    },
    with: { event: { columns: EVENT_PASS_COLUMNS } },
  });

  if (ticket?.event) {
    const buffer = await renderPass({
      ticketId: ticket.id,
      email: ticket.email,
      name: ticket.name,
      ticketType: ticket.type,
      event: ticket.event,
      cancelled: false,
      checkedIn: ticket.scanned,
    });
    if (!buffer) return null;
    return { buffer, lastModified: ticket.walletUpdatedAt ?? ticket.createdAt };
  }

  // No live ticket — fall back to a voided-pass tombstone if one exists.
  const tombstone = await db.query.walletVoidedPasses.findFirst({
    where: eq(walletVoidedPasses.serialNumber, ticketId),
    columns: {
      email: true,
      name: true,
      ticketType: true,
      eventId: true,
      voidedAt: true,
    },
  });
  if (!tombstone?.eventId) return null;

  const event = await db.query.events.findFirst({
    where: eq(events.id, tombstone.eventId),
    columns: EVENT_PASS_COLUMNS,
  });
  if (!event) return null;

  const buffer = await renderPass({
    ticketId,
    email: tombstone.email,
    name: tombstone.name,
    ticketType: tombstone.ticketType,
    event,
    cancelled: true,
    checkedIn: false,
  });
  if (!buffer) return null;
  return { buffer, lastModified: tombstone.voidedAt };
}
