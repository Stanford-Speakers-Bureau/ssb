import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { isValidUUID } from "@/app/lib/validation";
import { db, eq, events, inArray, notify, tickets, userProfiles } from "@ssb/db";

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

    // Fetch event, notifications, and ticket emails in parallel
    const [event, notifications, ticketResults] = await Promise.all([
      db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          name: true,
          route: true,
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
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      }),
      db.query.tickets.findMany({
        where: eq(tickets.eventId, eventId),
        columns: { email: true },
      }),
    ]);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const ticketEmailSet = new Set(
      ticketResults.map((t) => t.email.trim().toLowerCase()),
    );
    const notificationEmails = [...new Set(
      notifications.map((n) => n.email.trim().toLowerCase()),
    )];
    const profiles = notificationEmails.length > 0
      ? await db.query.userProfiles.findMany({
        where: inArray(userProfiles.email, notificationEmails),
        columns: {
          email: true,
          displayName: true,
          eduPersonAffiliation: true,
        },
      })
      : [];
    const profileByEmail = new Map(
      profiles.map((profile) => [
        profile.email.toLowerCase(),
        profile,
      ]),
    );

    const now = new Date();
    const ticketingOpen = event.ticketingDate
      ? now >= new Date(event.ticketingDate)
      : false;

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        email: n.email,
        created_at: n.createdAt.toISOString(),
        hasTicket: ticketEmailSet.has(n.email.trim().toLowerCase()),
        hasProfile: profileByEmail.has(n.email.trim().toLowerCase()),
        displayName: profileByEmail.get(n.email.trim().toLowerCase())?.displayName ?? null,
        affiliations: profileByEmail.get(n.email.trim().toLowerCase())?.eduPersonAffiliation ?? [],
      })),
      eventData: {
        name: event.name,
        route: event.route,
        start_time_date: event.startTimeDate?.toISOString() ?? null,
        ticketing_date: event.ticketingDate?.toISOString() ?? null,
        ticketingOpen,
      },
    });
  } catch (error) {
    console.error("Admin notify fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
