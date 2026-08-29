import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { isValidUUID } from "@/app/lib/validation";
import { db, eq, and, isNotNull, count as dbCount, referrals, tickets, events } from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    if (eventId && !isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Valid event ID is required" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("events.edit", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Build where conditions
    const referralConditions = eventId ? eq(referrals.eventId, eventId) : undefined;
    const ticketConditions = eventId
      ? and(eq(tickets.scanned, true), isNotNull(tickets.referral), eq(tickets.eventId, eventId))
      : and(eq(tickets.scanned, true), isNotNull(tickets.referral));

    // Fetch referrals and checked-in ticket counts in parallel
    const [referralResults, checkedInCounts] = await Promise.all([
      db.query.referrals.findMany({
        where: referralConditions,
        columns: { referralCode: true, count: true, eventId: true },
        with: {
          event: {
            columns: { id: true, name: true, route: true, startTimeDate: true },
          },
        },
        orderBy: (t, { desc }) => [desc(t.count)],
      }),
      db.select({ referral: tickets.referral, eventId: tickets.eventId, count: dbCount() })
        .from(tickets).where(ticketConditions).groupBy(tickets.referral, tickets.eventId),
    ]);

    // Build a map of referral_code -> event_id -> checked_in_count
    const checkedInMap: Record<string, Record<string, number>> = {};
    checkedInCounts.forEach((row) => {
      if (!row.referral || !row.eventId) return;
      if (!checkedInMap[row.referral]) {
        checkedInMap[row.referral] = {};
      }
      checkedInMap[row.referral][row.eventId] = row.count;
    });

    // Group by event if no eventId filter
    if (!eventId) {
      const groupedByEvent: Record<
        string,
        {
          event: { id: string; name: string | null; route: string | null };
          referrals: Array<{
            referral_code: string;
            count: number;
            checked_in_count: number;
          }>;
        }
      > = {};

      referralResults.forEach((ref) => {
        const evtId = ref.eventId;
        if (!evtId || !ref.event) return;

        if (!groupedByEvent[evtId]) {
          groupedByEvent[evtId] = {
            event: {
              id: ref.event.id,
              name: ref.event.name ?? null,
              route: ref.event.route ?? null,
            },
            referrals: [],
          };
        }

        const refCode = ref.referralCode ?? "";
        groupedByEvent[evtId].referrals.push({
          referral_code: refCode,
          count: ref.count || 0,
          checked_in_count: checkedInMap[refCode]?.[evtId] || 0,
        });
      });

      // Sort referrals within each event by count
      Object.values(groupedByEvent).forEach((group) => {
        group.referrals.sort((a, b) => b.count - a.count);
      });

      return NextResponse.json({
        leaderboard: Object.values(groupedByEvent),
        grouped: true,
      });
    }

    // Single event - return flat list
    const leaderboard = referralResults
      .map((ref) => ({
        referral_code: ref.referralCode ?? "",
        count: ref.count || 0,
        checked_in_count: checkedInMap[ref.referralCode ?? ""]?.[ref.eventId] || 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Query event directly for full data including referralsEnabled
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { id: true, name: true, route: true, startTimeDate: true, referralsEnabled: true },
    });

    return NextResponse.json({
      leaderboard,
      event: event
        ? {
            id: event.id,
            name: event.name ?? null,
            route: event.route ?? null,
            start_time_date: event.startTimeDate?.toISOString() ?? null,
            referrals_enabled: event.referralsEnabled,
          }
        : null,
      grouped: false,
    });
  } catch (error) {
    console.error("Referral leaderboard fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { eventId, referrals_enabled } = body;

    if (!eventId || typeof eventId !== "string" || !isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Valid eventId is required" },
        { status: 400 },
      );
    }

    if (typeof referrals_enabled !== "boolean") {
      return NextResponse.json(
        { error: "referrals_enabled must be a boolean" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("events.edit", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { name: true },
    });

    await db
      .update(events)
      .set({ referralsEnabled: referrals_enabled })
      .where(eq(events.id, eventId));

    await logAuditEvent({
      action: "referral.toggle",
      actor: auth.email!,
      eventId: eventId,
      eventName: event?.name ?? null,
      metadata: { referralsEnabled: referrals_enabled },
    });

    return NextResponse.json({ success: true, referrals_enabled });
  } catch (error) {
    console.error("Referral toggle error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
