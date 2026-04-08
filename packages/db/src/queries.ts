import { eq, and, count, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";
import { tickets, events, waitlist } from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Gets detailed ticket counts for an event.
 * Separates VIP and public tickets for proper capacity management.
 */
export async function getTicketCounts(
  db: Db,
  eventId: string,
): Promise<{
  vipCount: number;
  publicCount: number;
  standbyCount: number;
  totalCount: number;
}> {
  const [ticketCounts] = await db.select({
    vipCount:
      sql<number>`coalesce(count(${tickets.id}) filter (where coalesce(${tickets.type}, 'STANDARD') = 'VIP'), 0)::int`,
    publicCount:
      sql<number>`coalesce(count(${tickets.id}) filter (where coalesce(${tickets.type}, 'STANDARD') <> 'VIP' and coalesce(${tickets.type}, 'STANDARD') <> 'STANDBY'), 0)::int`,
    standbyCount:
      sql<number>`coalesce(count(${tickets.id}) filter (where coalesce(${tickets.type}, 'STANDARD') = 'STANDBY'), 0)::int`,
  })
    .from(tickets)
    .where(eq(tickets.eventId, eventId));

  const vipCount = ticketCounts?.vipCount ?? 0;
  const publicCount = ticketCounts?.publicCount ?? 0;
  const standbyCount = ticketCounts?.standbyCount ?? 0;

  return {
    vipCount,
    publicCount,
    standbyCount,
    totalCount: vipCount + publicCount + standbyCount,
  };
}

/**
 * Calculates available public ticket capacity with VIP overflow protection.
 */
export async function getAvailablePublicTickets(
  db: Db,
  eventId: string,
): Promise<{
  available: number;
  publicSold: number;
  maxPublic: number;
  vipCount: number;
  standbyCount: number;
  standbyEnabled: boolean;
  totalCapacity: number;
  reserved: number;
}> {
  const [eventSummary] = await db.select({
    capacity: events.capacity,
    reserved: events.reserved,
    standbyEnabled: events.standbyEnabled,
    vipCount:
      sql<number>`coalesce(count(${tickets.id}) filter (where coalesce(${tickets.type}, 'STANDARD') = 'VIP'), 0)::int`,
    publicCount:
      sql<number>`coalesce(count(${tickets.id}) filter (where coalesce(${tickets.type}, 'STANDARD') <> 'VIP' and coalesce(${tickets.type}, 'STANDARD') <> 'STANDBY'), 0)::int`,
    standbyCount:
      sql<number>`coalesce(count(${tickets.id}) filter (where coalesce(${tickets.type}, 'STANDARD') = 'STANDBY'), 0)::int`,
  })
    .from(events)
    .leftJoin(tickets, eq(tickets.eventId, events.id))
    .where(eq(events.id, eventId))
    .groupBy(events.id);

  if (!eventSummary || !eventSummary.capacity) {
    return {
      available: 0,
      publicSold: 0,
      maxPublic: 0,
      vipCount: 0,
      standbyCount: 0,
      standbyEnabled: false,
      totalCapacity: 0,
      reserved: 0,
    };
  }

  const capacity = eventSummary.capacity;
  const reserved = eventSummary.reserved ?? 0;
  const standbyEnabled = eventSummary.standbyEnabled ?? false;
  const vipCount = eventSummary.vipCount ?? 0;
  const publicCount = eventSummary.publicCount ?? 0;
  const standbyCount = eventSummary.standbyCount ?? 0;

  let maxPublic: number;
  if (vipCount <= reserved) {
    maxPublic = capacity - reserved;
  } else {
    maxPublic = capacity - vipCount;
  }

  maxPublic = Math.max(0, maxPublic);
  const available = standbyEnabled
    ? 0
    : Math.max(0, maxPublic - publicCount);

  return {
    available,
    publicSold: publicCount,
    maxPublic,
    vipCount,
    standbyCount,
    standbyEnabled,
    totalCapacity: capacity,
    reserved,
  };
}

/**
 * Check if an event is under capacity (has available public tickets).
 */
export async function isEventUnderCapacity(
  db: Db,
  eventId: string,
): Promise<boolean> {
  const ticketInfo = await getAvailablePublicTickets(db, eventId);
  return ticketInfo.available > 0;
}

/**
 * Get user's waitlist status for an event.
 */
export async function getUserWaitlistStatus(
  db: Db,
  eventId: string,
  userEmail: string,
): Promise<{
  isOnWaitlist: boolean;
  position: number | null;
  totalWaitlist: number;
}> {
  const [entry, [totalResult]] = await Promise.all([
    db.query.waitlist.findFirst({
      where: and(eq(waitlist.eventId, eventId), eq(waitlist.email, userEmail)),
      columns: { position: true },
    }),
    db.select({ count: count() })
      .from(waitlist)
      .where(eq(waitlist.eventId, eventId)),
  ]);

  return {
    isOnWaitlist: !!entry,
    position: entry ? entry.position : null,
    totalWaitlist: totalResult?.count ?? 0,
  };
}

/**
 * Get total waitlist count for an event.
 */
export async function getWaitlistCount(
  db: Db,
  eventId: string,
): Promise<number> {
  const [result] = await db.select({ count: count() })
    .from(waitlist)
    .where(eq(waitlist.eventId, eventId));
  return result?.count ?? 0;
}
