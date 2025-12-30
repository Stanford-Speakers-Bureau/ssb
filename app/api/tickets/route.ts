import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSupabaseClient,
  updateReferralRecords,
} from "@/app/lib/supabase";
import { generateReferralCode } from "@/app/lib/utils";
import { cookies } from "next/headers";
import { checkRateLimit, ticketRatelimit } from "@/app/lib/ratelimit";
import { sendTicketEmail } from "@/app/lib/email";

const TICKET_MESSAGES = {
  SUCCESS: "You're ticket has been emailed to you!d",
  DELETED: "Ticket cancelled successfully!",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_MISSING_EVENT_ID: "Missing required field: event_id",
  ERROR_EVENT_NOT_FOUND: "Event not found",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in.",
  ERROR_ALREADY_HAS_TICKET: "You already have a ticket for this event.",
  ERROR_NO_TICKET: "You don't have a ticket for this event.",
  ERROR_CAPACITY_EXCEEDED: "This event is at full capacity.",
  ERROR_LIVE_EVENT: "Cannot cancel tickets while an event is live.",
  ERROR_EVENT_STARTED:
    "Ticket sales have ended. This event has already started.",
} as const;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || searchParams.get("event_id");
    const count = searchParams.get("count");

    // 1. Handle Public Ticket Count
    if (count === "true" && eventId) {
      const adminClient = getSupabaseClient();
      const { count: ticketCount, error } = await adminClient
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId);

      if (error) {
        console.error("Ticket count error:", error);
        return NextResponse.json(
          { error: "Failed to fetch ticket count" },
          { status: 500 },
        );
      }

      return NextResponse.json({ count: ticketCount ?? 0 }, { status: 200 });
    }

    // 3. Handle User Request (Get My Tickets)
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in." },
        { status: 401 },
      );
    }

    const adminClient = getSupabaseClient();
    const { data: tickets, error } = await adminClient
      .from("tickets")
      .select(
        `
        id,
        event_id,
        created_at,
        type,
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

    if (error) {
      console.error("Error fetching user tickets:", error);
      return NextResponse.json(
        { error: "Failed to fetch tickets" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        tickets: tickets || [],
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Tickets fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    // --- USER CREATE TICKET ---
    if (userError || !user?.email) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    // Rate limit by user email
    const rateLimitResponse = await checkRateLimit(
      ticketRatelimit,
      `ticket:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event_id, referral: referralFromBody } = body;

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_MISSING_EVENT_ID },
        { status: 400 },
      );
    }

    // Get referral from request body first, then fall back to cookie if not provided
    let referral: string | null = referralFromBody || null;
    if (!referral) {
      const cookieStore = await cookies();
      referral = cookieStore.get("referral")?.value || null;
    }

    const adminClient = getSupabaseClient();
    const { data: event } = await adminClient
      .from("events")
      .select("start_time_date")
      .eq("id", event_id)
      .single();

    if (!event) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    if (event.start_time_date) {
      const eventStartTime = new Date(event.start_time_date);
      const now = new Date();
      if (now >= eventStartTime) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_EVENT_STARTED },
          { status: 400 },
        );
      }
    }

    if (referral) {
      const userReferralCode = generateReferralCode(user.email);
      if (referral.trim() === userReferralCode) {
        return NextResponse.json(
          { error: "You cannot use your own referral code" },
          { status: 400 },
        );
      }

      const { data: referralRecord } = await adminClient
        .from("referrals")
        .select("id")
        .eq("event_id", event_id)
        .eq("referral_code", referral.trim())
        .single();

      if (!referralRecord) {
        return NextResponse.json(
          { error: "Invalid referral code for this event" },
          { status: 400 },
        );
      }
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "create_ticket",
      {
        p_event_id: event_id,
        p_referral: referral,
      },
    );

    if (rpcError) {
      if (rpcError.code === "42883") {
        console.error("Ticket RPC missing:", rpcError);
        return NextResponse.json(
          {
            error:
              "Ticket creation RPC is not installed in the database (create_ticket).",
          },
          { status: 500 },
        );
      }

      const msg = (rpcError.message || "").toLowerCase();
      if (rpcError.code === "P0001" || msg.includes("capacity")) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_CAPACITY_EXCEEDED },
          { status: 400 },
        );
      }
      if (rpcError.code === "P0001" || msg.includes("already")) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_ALREADY_HAS_TICKET },
          { status: 400 },
        );
      }
      if (rpcError.code === "P0001" || msg.includes("event_not_found")) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_EVENT_NOT_FOUND },
          { status: 404 },
        );
      }

      console.error("Ticket RPC error:", rpcError);
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    const { data: ticket } = await adminClient
      .from("tickets")
      .select(
        `
          id,
          email,
          type,
          event_id,
          events (
            id,
            name,
            route,
            start_time_date,
            venue,
            venue_link,
            desc
          )
        `,
      )
      .eq("event_id", event_id)
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    await updateReferralRecords(event_id, user.email);

    if (ticket) {
      try {
        const event = Array.isArray(ticket.events)
          ? ticket.events[0]
          : ticket.events;
        await sendTicketEmail({
          email: ticket.email,
          eventName: event?.name || "Event",
          ticketType: ticket.type || "STANDARD",
          eventStartTime: event?.start_time_date || null,
          eventRoute: event?.route || null,
          ticketId: ticket.id,
          eventVenue: event?.venue || null,
          eventVenueLink: event?.venue_link || null,
          eventDescription: event?.desc || null,
        });
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        return NextResponse.json(
          {
            error:
              "Ticket was created but failed to send confirmation email. Please contact support.",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: TICKET_MESSAGES.SUCCESS,
        ticketId: ticket?.id ?? null,
        data: rpcData ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Ticket creation error:", error);
    return NextResponse.json(
      { error: TICKET_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}
