import AdminEventsClient, { Event } from "./AdminEventsClient";
import { getSignedImageUrl, serializeEvent } from "@/app/lib/supabase";
import {
  canUseActionForEvent,
  getEffectivePermissions,
  permittedEventIdsForAction,
} from "@/app/lib/permissions";
import { getSessionUser } from "@/app/lib/auth";
import {
  and,
  count as dbCount,
  db,
  eq,
  inArray,
  ne,
  tickets,
  waitlist,
} from "@ssb/db";
import { connection } from "next/server";

export const dynamic = "force-dynamic";

async function getInitialEvents(): Promise<Event[]> {
  try {
    const user = await getSessionUser();
    const perms = await getEffectivePermissions(user?.email);
    const editableEventIds = permittedEventIdsForAction(perms, "events.edit");
    const canCreate = canUseActionForEvent(perms, "events.create", null);

    if (!canCreate && editableEventIds?.size === 0) {
      return [];
    }
    if (editableEventIds?.size === 0) return [];

    const events = await db.query.events.findMany({
      where: editableEventIds
        ? (t, { inArray: inArrayOp }) => inArrayOp(t.id, [...editableEventIds])
        : undefined,
      orderBy: (t, { desc }) => [desc(t.startTimeDate)],
    });

    // Batch count queries — one query each instead of per-event
    const [ticketCounts, waitlistCounts, standbyCounts] = await Promise.all([
      db
        .select({ eventId: tickets.eventId, count: dbCount() })
        .from(tickets)
        .where(
          editableEventIds
            ? and(
                ne(tickets.type, "STANDBY"),
                inArray(tickets.eventId, [...editableEventIds]),
              )
            : ne(tickets.type, "STANDBY"),
        )
        .groupBy(tickets.eventId),
      db
        .select({ eventId: waitlist.eventId, count: dbCount() })
        .from(waitlist)
        .where(
          editableEventIds
            ? inArray(waitlist.eventId, [...editableEventIds])
            : undefined,
        )
        .groupBy(waitlist.eventId),
      db
        .select({ eventId: tickets.eventId, count: dbCount() })
        .from(tickets)
        .where(
          editableEventIds
            ? and(
                eq(tickets.type, "STANDBY"),
                inArray(tickets.eventId, [...editableEventIds]),
              )
            : eq(tickets.type, "STANDBY"),
        )
        .groupBy(tickets.eventId),
    ]);

    const ticketMap = new Map(ticketCounts.map((r) => [r.eventId, r.count]));
    const waitlistMap = new Map(
      waitlistCounts.map((r) => [r.eventId, r.count]),
    );
    const standbyMap = new Map(standbyCounts.map((r) => [r.eventId, r.count]));

    const eventsWithImages = await Promise.all(
      events.map(async (event) => {
        const serialized = serializeEvent(event);
        return {
          ...serialized,
          image_url: event.img
            ? await getSignedImageUrl(event.img, 60 * 60)
            : null,
          mobile_image_url: event.mobileImg
            ? await getSignedImageUrl(event.mobileImg, 60 * 60)
            : null,
          tickets_sold: ticketMap.get(event.id) ?? 0,
          waitlist_count: waitlistMap.get(event.id) ?? 0,
          standby_count: standbyMap.get(event.id) ?? 0,
        };
      }),
    );

    return eventsWithImages as Event[];
  } catch (error) {
    console.error("Failed to fetch initial events:", error);
    return [];
  }
}

export default async function AdminEventsPage() {
  await connection();
  const initialEvents = await getInitialEvents();
  return <AdminEventsClient initialEvents={initialEvents} />;
}
