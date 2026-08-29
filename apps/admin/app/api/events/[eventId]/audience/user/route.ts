import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { isValidEmail, isValidUUID } from "@/app/lib/validation";
import { db, eq, events, inArray, notify, tickets, waitlist } from "@ssb/db";

type EventSummary = {
  id: string;
  name: string | null;
  route: string | null;
  date: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function eventSummaryFromRecord(event: {
  id: string;
  name: string | null;
  route: string | null;
  startTimeDate: Date | null;
}): EventSummary {
  return {
    id: event.id,
    name: event.name,
    route: event.route,
    date: event.startTimeDate?.toISOString() ?? null,
  };
}

function sortEventSummaries(a: EventSummary, b: EventSummary): number {
  const aTime = a.date ? new Date(a.date).getTime() : 0;
  const bTime = b.date ? new Date(b.date).getTime() : 0;
  return bTime - aTime;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get("email");

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Valid event ID is required" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("audience.view", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    if (!emailParam || !isValidEmail(emailParam)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 },
      );
    }

    const email = normalizeEmail(emailParam);

    const [selectedEvent, notifyRows, waitlistRows, ticketRows] = await Promise.all([
      db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          id: true,
        },
      }),
      db.query.notify.findMany({
        where: eq(notify.email, email),
        columns: {
          speakerId: true,
        },
      }),
      db.query.waitlist.findMany({
        where: eq(waitlist.email, email),
        columns: {
          eventId: true,
        },
      }),
      db.query.tickets.findMany({
        where: eq(tickets.email, email),
        columns: {
          eventId: true,
          scanned: true,
        },
      }),
    ]);

    if (!selectedEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const notifyEventIds = new Set(
      notifyRows.map((row) => row.speakerId).filter(Boolean),
    );
    const waitlistEventIds = new Set<string>();
    const ticketedEventIds = new Set<string>();
    const attendedEventIds = new Set<string>();

    for (const row of waitlistRows) {
      if (!row.eventId) continue;
      waitlistEventIds.add(row.eventId);
    }

    for (const row of ticketRows) {
      if (!row.eventId) continue;
      ticketedEventIds.add(row.eventId);
      if (row.scanned) {
        attendedEventIds.add(row.eventId);
      }
    }

    const relatedEventIds = Array.from(
      new Set([
        ...notifyEventIds,
        ...waitlistEventIds,
        ...ticketedEventIds,
        ...attendedEventIds,
      ]),
    );

    if (relatedEventIds.length === 0) {
      return NextResponse.json({
        notifyEvents: [],
        waitlistEvents: [],
        ticketedEvents: [],
        attendedEvents: [],
      });
    }

    const relatedEvents = await db.query.events.findMany({
      where: inArray(events.id, relatedEventIds),
      columns: {
        id: true,
        name: true,
        route: true,
        startTimeDate: true,
      },
    });

    const eventMap = new Map(relatedEvents.map((event) => [event.id, event]));

    const notifyEvents = Array.from(notifyEventIds)
      .map((id) => eventMap.get(id))
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .map(eventSummaryFromRecord)
      .sort(sortEventSummaries);
    const waitlistEvents = Array.from(waitlistEventIds)
      .map((id) => eventMap.get(id))
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .map(eventSummaryFromRecord)
      .sort(sortEventSummaries);
    const ticketedEvents = Array.from(ticketedEventIds)
      .map((id) => eventMap.get(id))
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .map(eventSummaryFromRecord)
      .sort(sortEventSummaries);
    const attendedEvents = Array.from(attendedEventIds)
      .map((id) => eventMap.get(id))
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .map(eventSummaryFromRecord)
      .sort(sortEventSummaries);

    return NextResponse.json({
      notifyEvents,
      waitlistEvents,
      ticketedEvents,
      attendedEvents,
    });
  } catch (error) {
    console.error("Audience user detail fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
