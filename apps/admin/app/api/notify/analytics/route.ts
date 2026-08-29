import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { isValidUUID } from "@/app/lib/validation";
import { db, eq, ne, and, lt, events, inArray, notify, tickets, userProfiles } from "@ssb/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 },
      );
    }

    if (!isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Invalid event ID format" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("audience.view", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Phase 1: Parallel queries for event, signups, and tickets
    const [event, notifications, ticketResults] = await Promise.all([
      db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          name: true,
          releaseDate: true,
          startTimeDate: true,
          ticketingDate: true,
        },
      }),
      db.query.notify.findMany({
        where: eq(notify.speakerId, eventId),
        columns: {
          id: true,
          email: true,
          createdAt: true,
        },
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      }),
      db.query.tickets.findMany({
        where: eq(tickets.eventId, eventId),
        columns: { email: true },
      }),
    ]);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const uniqueEmails = [
      ...new Set(notifications.map((n) => n.email.trim().toLowerCase())),
    ];

    const ticketEmailSet = new Set(
      ticketResults.map((t) => t.email.trim().toLowerCase()),
    );
    const currentAudienceEmails = [
      ...new Set([...uniqueEmails, ...ticketEmailSet]),
    ];

    const now = new Date();

    // Phase 2: Dependent queries for profiles and past-event audience lookup
    const [profiles, pastEvents] = await Promise.all([
      uniqueEmails.length > 0
        ? db.query.userProfiles.findMany({
            where: inArray(userProfiles.email, uniqueEmails),
            columns: {
              email: true,
              eduPersonAffiliation: true,
            },
          })
        : [],
      db.query.events.findMany({
        where: and(
          ne(events.id, eventId),
          lt(events.startTimeDate, now),
        ),
        columns: {
          id: true,
          name: true,
        },
      }),
    ]);

    // Build profile lookup
    const profileByEmail = new Map(
      profiles.map((p) => [p.email.toLowerCase(), p]),
    );

    // Build affiliations parallel array
    const affiliations = notifications.map((n) => {
      const profile = profileByEmail.get(n.email.trim().toLowerCase());
      return profile?.eduPersonAffiliation ?? [];
    });

    // Conversion rate
    const ticketHolders = uniqueEmails.filter((e) =>
      ticketEmailSet.has(e),
    ).length;

    const pastEventIds = pastEvents.map((pastEvent) => pastEvent.id);

    const [pastNotifyRows, pastTicketRows] =
      currentAudienceEmails.length > 0 && pastEventIds.length > 0
        ? await Promise.all([
            db.query.notify.findMany({
              where: and(
                inArray(notify.email, currentAudienceEmails),
                inArray(notify.speakerId, pastEventIds),
              ),
              columns: {
                email: true,
                speakerId: true,
              },
            }),
            db.query.tickets.findMany({
              where: and(
                inArray(tickets.email, currentAudienceEmails),
                inArray(tickets.eventId, pastEventIds),
              ),
              columns: {
                email: true,
                eventId: true,
              },
            }),
          ])
        : [[], []];

    // Cross-pollination: group by past event, count unique emails across notify + ticket holders
    const crossPollinationMap = new Map<string, Set<string>>();
    const crossPollinatedPeopleSet = new Set<string>();

    for (const row of pastNotifyRows) {
      const email = row.email.trim().toLowerCase();
      if (!crossPollinationMap.has(row.speakerId)) {
        crossPollinationMap.set(row.speakerId, new Set());
      }
      crossPollinationMap.get(row.speakerId)!.add(email);
      crossPollinatedPeopleSet.add(email);
    }

    for (const row of pastTicketRows) {
      const email = row.email.trim().toLowerCase();
      if (!row.eventId) continue;
      if (!crossPollinationMap.has(row.eventId)) {
        crossPollinationMap.set(row.eventId, new Set());
      }
      crossPollinationMap.get(row.eventId)!.add(email);
      crossPollinatedPeopleSet.add(email);
    }

    const eventNameMap = new Map(pastEvents.map((pastEvent) => [pastEvent.id, pastEvent.name]));
    const crossPollination = [...crossPollinationMap.keys()]
      .map((eid) => ({
        eventId: eid,
        eventName: eventNameMap.get(eid) ?? null,
        sharedCount: crossPollinationMap.get(eid)!.size,
      }))
      .sort((a, b) => b.sharedCount - a.sharedCount);

    return NextResponse.json({
      eventName: event.name,
      releaseDate: event.releaseDate?.toISOString() ?? null,
      ticketingDate: event.ticketingDate?.toISOString() ?? null,
      totalSignups: notifications.length,
      uniqueSignups: uniqueEmails.length,
      ticketHolders,
      conversionRate:
        uniqueEmails.length > 0
          ? (ticketHolders / uniqueEmails.length) * 100
          : 0,
      timestamps: notifications.map((n) => n.createdAt.toISOString()),
      affiliations,
      crossPollinatedPeople: crossPollinatedPeopleSet.size,
      crossPollination,
    });
  } catch (error) {
    console.error("Notify analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
