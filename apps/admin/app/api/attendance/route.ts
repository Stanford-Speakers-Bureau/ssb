import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { db, desc, events, tickets, lt, inArray } from "@ssb/db";

export async function GET() {
  try {
    // Attendance spans all events, so it needs the all-events audience scope.
    const auth = await requirePermission("audience.view");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Only include past events (started before now)
    const now = new Date();
    const pastEvents = await db.query.events.findMany({
      where: lt(events.startTimeDate, now),
      columns: {
        id: true,
        name: true,
        startTimeDate: true,
        capacity: true,
      },
      orderBy: desc(events.startTimeDate),
    });

    if (pastEvents.length === 0) {
      return NextResponse.json({
        attendees: [],
        events: [],
        stats: {
          totalUniqueAttendees: 0,
          averageAttendanceRate: 0,
          perfectAttendanceCount: 0,
          zeroAttendanceCount: 0,
          averageEventsPerPerson: 0,
          repeatRate: 0,
        },
      });
    }

    // Fetch only tickets for past events
    const pastEventIds = pastEvents.map((e) => e.id);
    const relevantTickets = await db.query.tickets.findMany({
      where: inArray(tickets.eventId, pastEventIds),
      columns: {
        email: true,
        name: true,
        eventId: true,
        scanned: true,
        type: true,
      },
    }) as Array<{ email: string; name: string | null; eventId: string; scanned: boolean | null; type: string | null }>;

    // Build event lookup
    const eventMap = new Map(
      pastEvents.map((e) => [
        e.id,
        {
          id: e.id,
          name: e.name,
          date: e.startTimeDate?.toISOString() ?? null,
          capacity: e.capacity ?? 0,
          totalTickets: 0,
          scannedCount: 0,
        },
      ]),
    );

    // Compute per-event stats
    for (const t of relevantTickets) {
      const ev = eventMap.get(t.eventId);
      if (ev) {
        ev.totalTickets++;
        if (t.scanned) ev.scannedCount++;
      }
    }

    // Group tickets by email (lowercase normalized)
    const attendeeMap = new Map<
      string,
      {
        email: string;
        name: string | null;
        events: Map<
          string,
          { eventId: string; attended: boolean; type: string | null }
        >;
      }
    >();

    for (const t of relevantTickets) {
      const key = t.email.toLowerCase();
      if (!attendeeMap.has(key)) {
        attendeeMap.set(key, {
          email: t.email,
          name: t.name,
          events: new Map(),
        });
      }
      const person = attendeeMap.get(key)!;
      // Use most recent non-null name
      if (t.name && !person.name) person.name = t.name;
      // One entry per event — if they have multiple tickets for same event, mark attended if any scanned
      const existing = person.events.get(t.eventId);
      if (existing) {
        if (t.scanned) existing.attended = true;
      } else {
        person.events.set(t.eventId, {
          eventId: t.eventId,
          attended: t.scanned ?? false,
          type: t.type,
        });
      }
    }

    // Build attendee list sorted by events in chronological order
    const sortedEventIds = pastEvents.map((e) => e.id);

    const attendees = Array.from(attendeeMap.values()).map((person) => {
      const eventsRegistered = person.events.size;
      const eventsAttended = Array.from(person.events.values()).filter(
        (e) => e.attended,
      ).length;
      const attendanceRate =
        eventsRegistered > 0 ? eventsAttended / eventsRegistered : 0;

      // Calculate streak (consecutive attended from most recent)
      let currentStreak = 0;
      // Walk events from most recent to oldest
      const personEventIds = new Set(person.events.keys());
      for (const eid of sortedEventIds) {
        if (!personEventIds.has(eid)) continue;
        const ev = person.events.get(eid)!;
        if (ev.attended) {
          currentStreak++;
        } else {
          break;
        }
      }

      // First and last event dates
      let firstSeen: string | null = null;
      let lastSeen: string | null = null;
      // Walk oldest to newest
      for (let i = sortedEventIds.length - 1; i >= 0; i--) {
        if (person.events.has(sortedEventIds[i])) {
          const ev = eventMap.get(sortedEventIds[i]);
          if (ev?.date && !firstSeen) firstSeen = ev.date;
        }
      }
      for (const eid of sortedEventIds) {
        if (person.events.has(eid)) {
          const ev = eventMap.get(eid);
          if (ev?.date) {
            lastSeen = ev.date;
            break;
          }
        }
      }

      const eventsList = sortedEventIds
        .filter((eid) => person.events.has(eid))
        .map((eid) => {
          const ev = eventMap.get(eid)!;
          const pe = person.events.get(eid)!;
          return {
            eventId: eid,
            eventName: ev.name,
            eventDate: ev.date,
            attended: pe.attended,
          };
        });

      return {
        email: person.email,
        name: person.name,
        eventsRegistered,
        eventsAttended,
        attendanceRate,
        currentStreak,
        firstSeen,
        lastSeen,
        events: eventsList,
      };
    });

    // Sort: by attendance rate desc, then by events registered desc
    attendees.sort((a, b) => {
      if (b.attendanceRate !== a.attendanceRate)
        return b.attendanceRate - a.attendanceRate;
      return b.eventsRegistered - a.eventsRegistered;
    });

    // Aggregate stats
    const totalUnique = attendees.length;
    const repeatAttendees = attendees.filter((a) => a.eventsAttended >= 2);
    const avgRate =
      totalUnique > 0
        ? attendees.reduce((s, a) => s + a.attendanceRate, 0) / totalUnique
        : 0;
    const perfectCount = attendees.filter(
      (a) => a.attendanceRate === 1 && a.eventsRegistered >= 2,
    ).length;
    const zeroCount = attendees.filter(
      (a) => a.attendanceRate === 0 && a.eventsRegistered >= 2,
    ).length;
    const avgEvents =
      totalUnique > 0
        ? attendees.reduce((s, a) => s + a.eventsRegistered, 0) / totalUnique
        : 0;
    const repeatRate =
      totalUnique > 0 ? repeatAttendees.length / totalUnique : 0;

    return NextResponse.json({
      attendees,
      events: Array.from(eventMap.values()).map(
        ({ id, name, date, capacity, totalTickets, scannedCount }) => ({
          id,
          name,
          date,
          capacity,
          totalTickets,
          scannedCount,
        }),
      ),
      stats: {
        totalUniqueAttendees: totalUnique,
        averageAttendanceRate: avgRate,
        perfectAttendanceCount: perfectCount,
        zeroAttendanceCount: zeroCount,
        averageEventsPerPerson: avgEvents,
        repeatRate,
      },
    });
  } catch (error) {
    console.error("Attendance data fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
