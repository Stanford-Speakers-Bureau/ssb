import { NextResponse } from "next/server";
import {
  getAvailablePublicTickets,
} from "@/app/lib/supabase";
import { getSessionUser } from "@/app/lib/auth";
import { db, eq, and, lt, sql, count, events, tickets, waitlist } from "@ssb/db";
import { checkRateLimit, ticketRatelimit } from "@/app/lib/ratelimit";
import { sendWaitlistEmail } from "@/app/lib/email";

const WAITLIST_MESSAGES = {
  SUCCESS: "You've been added to the waitlist!",
  DELETED: "Successfully left the waitlist",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in.",
  ERROR_EVENT_NOT_FOUND: "Event not found",
  ERROR_NOT_SOLD_OUT: "Event is not sold out. Please get a ticket instead.",
  ERROR_ALREADY_HAS_TICKET: "You already have a ticket for this event.",
  ERROR_ALREADY_ON_WAITLIST: "You're already on the waitlist for this event.",
  ERROR_NOT_ON_WAITLIST: "You're not on the waitlist for this event.",
  ERROR_WAITLIST_CLOSED:
    "Waitlist is now closed. Please visit the venue for the standby line.",
} as const;

type JoinWaitlistRpcResult = {
  position: number;
  total: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    // Rate limit by user email
    const rateLimitResponse = await checkRateLimit(
      ticketRatelimit,
      `waitlist:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event_id, referral, name: nameFromBody } = body as {
      event_id?: string;
      referral?: string;
      name?: string;
    };

    if (!event_id) {
      return NextResponse.json(
        { error: "Missing required field: event_id" },
        { status: 400 },
      );
    }

    // Get event details
    const event = await db.query.events.findFirst({
      where: eq(events.id, event_id),
      columns: {
        id: true,
        name: true,
        doorsOpen: true,
        startTimeDate: true,
        venue: true,
        venueLink: true,
        desc: true,
        standbyEnabled: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    // Block joining the online waitlist when standby mode is enabled
    if (event.standbyEnabled) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_WAITLIST_CLOSED },
        { status: 400 },
      );
    }

    // Check if event is sold out
    const { available } = await getAvailablePublicTickets(event_id);
    if (available > 0) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_NOT_SOLD_OUT },
        { status: 400 },
      );
    }

    // Check user doesn't already have a ticket
    const existingTicket = await db.query.tickets.findFirst({
      where: and(eq(tickets.eventId, event_id), eq(tickets.email, user.email)),
      columns: { id: true },
    });

    if (existingTicket) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_ALREADY_HAS_TICKET },
        { status: 400 },
      );
    }

    // Derive name from body override or OAuth metadata
    const waitlistName =
      nameFromBody?.trim() ||
      user.displayName ||
      null;

    if (!waitlistName) {
      return NextResponse.json(
        { error: "Name is required to join the waitlist" },
        { status: 400 },
      );
    }

    // Use stored procedure to atomically join waitlist (prevents position collisions)
    let rpcData: JoinWaitlistRpcResult | null = null;
    try {
      const result = await db.execute<{ join_waitlist_with_name: JoinWaitlistRpcResult }>(sql`
        SELECT join_waitlist_with_name(
          ${event_id}::uuid,
          ${referral || null},
          ${waitlistName},
          ${user.email}
        )
      `);
      rpcData = result[0]?.join_waitlist_with_name;
    } catch (rpcError: unknown) {
      const msg = getErrorMessage(rpcError).toLowerCase();
      if (msg.includes("does not exist") && msg.includes("function")) {
        console.error("Waitlist RPC missing:", rpcError);
        return NextResponse.json(
          {
            error:
              "Waitlist RPC is not installed in the database (join_waitlist_with_name).",
          },
          { status: 500 },
        );
      }
      if (msg.includes("already")) {
        return NextResponse.json(
          { error: WAITLIST_MESSAGES.ERROR_ALREADY_ON_WAITLIST },
          { status: 400 },
        );
      }

      console.error("Waitlist RPC error:", rpcError);
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    const nextPosition = rpcData?.position;

    if (!nextPosition) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    // Calculate actual position (same logic as GET handler)
    // This ensures the email shows the same position as the UI
    const [aheadResult] = await db.select({ count: count() })
      .from(waitlist)
      .where(and(eq(waitlist.eventId, event_id), lt(waitlist.position, nextPosition)));

    // User's actual position is count of people ahead + 1 (1-indexed)
    const actualPosition = (aheadResult?.count ?? 0) + 1;

    // Send email immediately
    try {
      await sendWaitlistEmail({
        email: user.email,
        eventName: event.name || "Event",
        position: actualPosition,
        eventStartTime: event.startTimeDate?.toISOString() ?? null,
        eventVenue: event.venue,
        eventVenueLink: event.venueLink,
        eventDescription: event.desc,
      });
    } catch (emailError) {
      console.error("Waitlist email error:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: WAITLIST_MESSAGES.SUCCESS,
        position: actualPosition,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Waitlist join error:", error);
    return NextResponse.json(
      { error: WAITLIST_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event_id } = body as { event_id?: string };

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: "Missing required field: event_id" },
        { status: 400 },
      );
    }

    // Use stored procedure to atomically leave waitlist (prevents race conditions during recalculation)
    try {
      await db.execute(sql`
        SELECT leave_waitlist(${event_id}::uuid, ${user.email})
      `);
    } catch (rpcError: unknown) {
      const msg = getErrorMessage(rpcError).toLowerCase();
      if (msg.includes("does not exist") && msg.includes("function")) {
        console.error("Waitlist RPC missing:", rpcError);
        return NextResponse.json(
          {
            error:
              "Waitlist RPC is not installed in the database (leave_waitlist).",
          },
          { status: 500 },
        );
      }
      if (msg.includes("not_found")) {
        return NextResponse.json(
          { error: WAITLIST_MESSAGES.ERROR_NOT_ON_WAITLIST },
          { status: 400 },
        );
      }

      console.error("Waitlist RPC error:", rpcError);
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: WAITLIST_MESSAGES.DELETED,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Waitlist delete error:", error);
    return NextResponse.json(
      { error: WAITLIST_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    if (eventId) {
      // Get status for specific event
      const entry = await db.query.waitlist.findFirst({
        where: and(eq(waitlist.eventId, eventId), eq(waitlist.email, user.email)),
        columns: { position: true },
      });

      const [totalResult] = await db.select({ count: count() })
        .from(waitlist)
        .where(eq(waitlist.eventId, eventId));

      // Calculate actual position by counting how many people are ahead (have lower position numbers)
      let actualPosition: number | null = null;
      if (entry) {
        const [aheadResult] = await db.select({ count: count() })
          .from(waitlist)
          .where(and(eq(waitlist.eventId, eventId), lt(waitlist.position, entry.position)));

        // User's actual position is count of people ahead + 1 (1-indexed)
        actualPosition = (aheadResult?.count ?? 0) + 1;
      }

      return NextResponse.json(
        {
          isOnWaitlist: !!entry,
          position: actualPosition,
          total: totalResult?.count ?? 0,
        },
        { status: 200 },
      );
    } else {
      // Get all waitlist entries for user
      const entries = await db.query.waitlist.findMany({
        where: eq(waitlist.email, user.email),
        columns: {
          id: true,
          position: true,
          createdAt: true,
          referral: true,
          eventId: true,
        },
        with: {
          event: {
            columns: {
              id: true,
              name: true,
              route: true,
              startTimeDate: true,
              venue: true,
            },
          },
        },
        orderBy: (waitlist, { desc }) => [desc(waitlist.createdAt)],
      });

      // Transform to match expected API shape (snake_case)
      const serializedEntries = entries.map((e) => ({
        id: e.id,
        position: e.position,
        created_at: e.createdAt.toISOString(),
        referral: e.referral,
        event_id: e.eventId,
        events: e.event
          ? {
              id: e.event.id,
              name: e.event.name,
              route: e.event.route,
              start_time_date: e.event.startTimeDate?.toISOString() ?? null,
              venue: e.event.venue,
            }
          : null,
      }));

      return NextResponse.json(
        {
          waitlists: serializedEntries,
        },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error("Waitlist status check error:", error);
    return NextResponse.json(
      { error: WAITLIST_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}
