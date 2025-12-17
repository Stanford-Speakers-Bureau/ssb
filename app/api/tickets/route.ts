import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSupabaseClient,
  updateReferralRecords,
  verifyAdminRequest,
} from "@/app/lib/supabase";
import { generateReferralCode } from "@/app/lib/utils";
import { cookies } from "next/headers";
import { checkRateLimit, ticketRatelimit } from "@/app/lib/ratelimit";
import { sendTicketEmail } from "@/app/lib/email";

const TICKET_MESSAGES = {
  SUCCESS: "Ticket created successfully!",
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
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

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

    // 2. Handle Admin Request
    const auth = await verifyAdminRequest();
    if (auth.authorized) {
      const adminClient = auth.adminClient!;
      let query = adminClient
        .from("tickets")
        .select(
          `
          id,
          email,
          type,
          created_at,
          scanned,
          scan_time,
          referral,
          event_id,
          events (
            id,
            name,
            route,
            start_time_date
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (eventId) {
        query = query.eq("event_id", eventId);
      }

      const { data: tickets, error } = await query.range(
        offset,
        offset + limit - 1,
      );

      if (error) {
        console.error("Tickets fetch error:", error);
        return NextResponse.json(
          { error: "Failed to fetch tickets" },
          { status: 500 },
        );
      }

      let countQuery = adminClient
        .from("tickets")
        .select("id", { count: "exact", head: true });
      if (eventId) {
        countQuery = countQuery.eq("event_id", eventId);
      }
      const { count: total } = await countQuery;

      return NextResponse.json({
        tickets: tickets || [],
        total: total || 0,
        limit,
        offset,
      });
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

    // Check if Admin
    const auth = await verifyAdminRequest();

    if (auth.authorized) {
      // --- ADMIN CREATE TICKET ---
      const body = await req.json();
      const { email, eventId, type } = body;

      if (!email || typeof email !== "string") {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 },
        );
      }

      if (!eventId || typeof eventId !== "string") {
        return NextResponse.json(
          { error: "Event ID is required" },
          { status: 400 },
        );
      }

      const adminClient = auth.adminClient!;

      // Check if event exists
      const { data: event, error: eventError } = await adminClient
        .from("events")
        .select("id, name, capacity")
        .eq("id", eventId)
        .single();

      if (eventError || !event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      // Check if user already has a ticket for this event
      const { data: existingTicket } = await adminClient
        .from("tickets")
        .select("id")
        .eq("event_id", eventId)
        .eq("email", email)
        .single();

      if (existingTicket) {
        return NextResponse.json(
          { error: "User already has a ticket for this event" },
          { status: 400 },
        );
      }

      // Create the ticket
      const { data: ticket, error: insertError } = await adminClient
        .from("tickets")
        .insert({
          event_id: eventId,
          email: email,
          type: type || "VIP", // Admin-created tickets default to VIP type
        })
        .select(
          `
          id,
          email,
          type,
          created_at,
          scanned,
          scan_time,
          referral,
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
        .single();

      if (insertError) {
        console.error("Ticket creation error:", insertError);
        return NextResponse.json(
          { error: "Failed to create ticket" },
          { status: 500 },
        );
      }

      // Send ticket confirmation email
      if (ticket) {
        try {
          const event = Array.isArray(ticket.events)
            ? ticket.events[0]
            : ticket.events;
          await sendTicketEmail({
            email: ticket.email,
            eventName: event?.name || "Event",
            ticketType: ticket.type || "VIP",
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

      return NextResponse.json({ success: true, ticket });
    } else {
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
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
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
    }
  } catch (error) {
    console.error("Ticket creation error:", error);
    return NextResponse.json(
      { error: TICKET_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { id, action, type, scanned } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 },
      );
    }

    const adminClient = auth.adminClient!;

    // Handle different actions
    if (action === "unscan") {
      // Unscan the ticket
      const { data: ticket, error: updateError } = await adminClient
        .from("tickets")
        .update({
          scanned: false,
          scan_time: null,
          scan_user: null,
          scan_email: null,
        })
        .eq("id", id)
        .select(
          `
          id,
          email,
          type,
          created_at,
          scanned,
          scan_time,
          referral,
          event_id,
          events (
            id,
            name,
            route,
            start_time_date
          )
        `,
        )
        .single();

      if (updateError) {
        console.error("Ticket unscan error:", updateError);
        return NextResponse.json(
          { error: "Failed to unscan ticket" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true, ticket });
    } else if (action === "updateType" || type) {
      // Update ticket type
      if (type !== "VIP" && type !== "STANDARD") {
        return NextResponse.json(
          { error: "Invalid ticket type. Must be 'VIP' or 'STANDARD'." },
          { status: 400 },
        );
      }

      const { data: ticket, error: updateError } = await adminClient
        .from("tickets")
        .update({ type })
        .eq("id", id)
        .select(
          `
          id,
          email,
          type,
          created_at,
          scanned,
          scan_time,
          referral,
          event_id,
          events (
            id,
            name,
            route,
            start_time_date
          )
        `,
        )
        .single();

      if (updateError) {
        console.error("Ticket type update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update ticket type" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true, ticket });
    } else if (action === "updateScanned" || typeof scanned === "boolean") {
      // Update scanned status
      const updateData: {
        scanned: boolean;
        scan_time?: string | null;
        scan_user?: string | null;
        scan_email?: string | null;
      } = {
        scanned,
      };

      if (!scanned) {
        updateData.scan_time = null;
        updateData.scan_user = null;
        updateData.scan_email = null;
      } else {
        updateData.scan_time = new Date().toISOString();
      }

      const { data: ticket, error: updateError } = await adminClient
        .from("tickets")
        .update(updateData)
        .eq("id", id)
        .select(
          `
          id,
          email,
          type,
          created_at,
          scanned,
          scan_time,
          referral,
          event_id,
          events (
            id,
            name,
            route,
            start_time_date
          )
        `,
        )
        .single();

      if (updateError) {
        console.error("Ticket scanned status update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update scanned status" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true, ticket });
    } else if (action === "resendEmail") {
      // Resend ticket confirmation email
      const { data: ticket, error: fetchError } = await adminClient
        .from("tickets")
        .select(
          `
          id,
          email,
          type,
          created_at,
          scanned,
          scan_time,
          referral,
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
        .eq("id", id)
        .single();

      if (fetchError || !ticket) {
        console.error("Ticket fetch error:", fetchError);
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      }

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
          { error: "Failed to send email" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "Email sent successfully",
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Invalid action. Use 'unscan', 'updateType', 'updateScanned', or 'resendEmail'.",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Ticket update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 },
      );
    }

    const adminClient = auth.adminClient!;

    const { error } = await adminClient.from("tickets").delete().eq("id", id);

    if (error) {
      console.error("Ticket delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete ticket" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ticket delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
