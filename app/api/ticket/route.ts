import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSupabaseClient,
} from "../../lib/supabase";
import { cookies } from "next/headers";

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
} as const;

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event_id } = body;

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_MISSING_EVENT_ID },
        { status: 400 },
      );
    }

    // Get referral from cookie if available
    const cookieStore = await cookies();
    const referral = cookieStore.get("referral")?.value || null;

    /**
     * IMPORTANT: To prevent race conditions (two users grabbing the last ticket),
     * ticket allocation MUST be enforced in the database atomically.
     *
     * This endpoint calls a Postgres function (`create_ticket`) that:
     * - locks the event row (FOR UPDATE)
     * - checks capacity using (capacity - reserved)
     * - checks for an existing ticket for this email
     * - inserts the ticket
     */
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "create_ticket",
      {
        p_event_id: event_id,
        p_referral: referral,
      },
    );

    if (rpcError) {
      // 42883 = undefined_function (RPC not installed)
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

      // P0001 is commonly used for raised exceptions in Postgres functions
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

    // Fetch the created ticket to get its ID
    const adminClient = getSupabaseClient();
    const { data: ticket } = await adminClient
      .from("tickets")
      .select("id")
      .eq("event_id", event_id)
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json(
      {
        success: true,
        message: TICKET_MESSAGES.SUCCESS,
        ticketId: ticket?.id ?? null,
        // `rpcData` shape depends on the SQL function; included for debugging / future use.
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

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event_id } = body;

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_MISSING_EVENT_ID },
        { status: 400 },
      );
    }

    const adminClient = getSupabaseClient();

    // Check if user has a ticket for this event
    const { data: existingTicket } = await adminClient
      .from("tickets")
      .select("id")
      .eq("event_id", event_id)
      .eq("email", user.email)
      .single();

    if (!existingTicket) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_NO_TICKET },
        { status: 400 },
      );
    }

    // Delete the ticket (hard delete)
    const { error: deleteError } = await adminClient
      .from("tickets")
      .delete()
      .eq("id", existingTicket.id);

    if (deleteError) {
      console.error("Ticket delete error:", deleteError);
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: TICKET_MESSAGES.DELETED,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Ticket deletion error:", error);
    return NextResponse.json(
      { error: TICKET_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}
