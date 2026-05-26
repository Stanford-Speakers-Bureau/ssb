import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { isValidUUID } from "@/app/lib/validation";
import { db, and, eq, events, notify, tickets, waitlist } from "@ssb/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || searchParams.get("event_id");

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "Missing required query parameter: eventId" },
        { status: 400 },
      );
    }

    if (!isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Invalid event ID format" },
        { status: 400 },
      );
    }

    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        {
          authenticated: false,
          userEmail: null,
          ticketId: null,
          ticketType: null,
          ticketName: null,
          ticketScanned: false,
          isOnWaitlist: false,
          waitlistPosition: null,
          isNotified: false,
          allowAdmittingStandby: false,
        },
        { status: 200 },
      );
    }

    const [ticket, waitlistEntry, notifyEntry, event] = await Promise.all([
      db.query.tickets.findFirst({
        where: and(eq(tickets.eventId, eventId), eq(tickets.email, user.email)),
        columns: {
          id: true,
          type: true,
          name: true,
          scanned: true,
        },
      }),
      db.query.waitlist.findFirst({
        where: and(eq(waitlist.eventId, eventId), eq(waitlist.email, user.email)),
        columns: {
          id: true,
          position: true,
        },
      }),
      db.query.notify.findFirst({
        where: and(eq(notify.email, user.email), eq(notify.speakerId, eventId)),
        columns: {
          id: true,
        },
      }),
      db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          allowAdmittingStandby: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        authenticated: true,
        userEmail: user.email,
        ticketId: ticket?.id ?? null,
        ticketType: ticket?.type ?? null,
        ticketName: ticket?.name ?? null,
        ticketScanned: ticket?.scanned ?? false,
        isOnWaitlist: !!waitlistEntry,
        waitlistPosition: waitlistEntry?.position ?? null,
        isNotified: !!notifyEntry,
        allowAdmittingStandby: event?.allowAdmittingStandby ?? false,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Viewer event state fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch viewer event state" },
      { status: 500 },
    );
  }
}

