import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSupabaseClient,
  getAvailablePublicTickets,
  isWaitlistClosed,
} from "@/app/lib/supabase";
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
    "Waitlist is now closed. Please visit the venue for in-person waitlist.",
} as const;

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
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

    const { event_id, referral } = body as {
      event_id?: string;
      referral?: string;
    };

    if (!event_id) {
      return NextResponse.json(
        { error: "Missing required field: event_id" },
        { status: 400 },
      );
    }

    // Get event details
    const adminClient = getSupabaseClient();
    const { data: event, error: eventError } = await adminClient
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    // Check if waitlist is closed (2 hours before event)
    if (isWaitlistClosed(event.start_time_date)) {
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
    const { data: existingTicket } = await adminClient
      .from("tickets")
      .select("id")
      .eq("event_id", event_id)
      .eq("email", user.email)
      .single();

    if (existingTicket) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_ALREADY_HAS_TICKET },
        { status: 400 },
      );
    }

    // Use RPC to atomically join waitlist (prevents position collisions)
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "join_waitlist",
      {
        p_event_id: event_id,
        p_referral: referral || null,
      },
    );

    if (rpcError) {
      if (rpcError.code === "42883") {
        console.error("Waitlist RPC missing:", rpcError);
        return NextResponse.json(
          {
            error:
              "Waitlist RPC is not installed in the database (join_waitlist).",
          },
          { status: 500 },
        );
      }

      const msg = (rpcError.message || "").toLowerCase();
      if (rpcError.code === "P0001" || msg.includes("already")) {
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

    const { position: nextPosition, total: totalCount } = rpcData as {
      position: number;
      total: number;
    };

    // Send email immediately
    try {
      await sendWaitlistEmail({
        email: user.email,
        eventName: event.name || "Event",
        position: nextPosition,
        totalWaitlist: totalCount || 0,
        eventStartTime: event.start_time_date,
        eventVenue: event.venue,
        eventVenueLink: event.venue_link,
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
        position: nextPosition,
        total: totalCount || 0,
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
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
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

    // Use RPC to atomically leave waitlist (prevents race conditions during recalculation)
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "leave_waitlist",
      {
        p_event_id: event_id,
      },
    );

    if (rpcError) {
      if (rpcError.code === "42883") {
        console.error("Waitlist RPC missing:", rpcError);
        return NextResponse.json(
          {
            error:
              "Waitlist RPC is not installed in the database (leave_waitlist).",
          },
          { status: 500 },
        );
      }

      const msg = (rpcError.message || "").toLowerCase();
      if (rpcError.code === "P0001" || msg.includes("not_found")) {
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
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    const adminClient = getSupabaseClient();

    if (eventId) {
      // Get status for specific event
      const { data: entry } = await adminClient
        .from("waitlist")
        .select("position")
        .eq("event_id", eventId)
        .eq("email", user.email)
        .single();

      const { count: totalCount } = await adminClient
        .from("waitlist")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId);

      // Calculate actual position by counting how many people are ahead (have lower position numbers)
      let actualPosition: number | null = null;
      if (entry) {
        const { count: aheadCount } = await adminClient
          .from("waitlist")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .lt("position", entry.position);

        // User's actual position is count of people ahead + 1 (1-indexed)
        actualPosition = (aheadCount || 0) + 1;
      }

      return NextResponse.json(
        {
          isOnWaitlist: !!entry,
          position: actualPosition,
          total: totalCount || 0,
        },
        { status: 200 },
      );
    } else {
      // Get all waitlist entries for user
      const { data: entries } = await adminClient
        .from("waitlist")
        .select(
          `
          id,
          position,
          created_at,
          referral,
          event_id,
          events (
            id,
            name,
            route,
            start_time_date,
            venue
          )
        `,
        )
        .eq("email", user.email)
        .order("created_at", { ascending: false });

      return NextResponse.json(
        {
          waitlists: entries || [],
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
