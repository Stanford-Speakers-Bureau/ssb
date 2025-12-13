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
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const { event_id } = body;

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_MISSING_EVENT_ID },
        { status: 400 },
      );
    }

    const adminClient = getSupabaseClient();

    // Verify event exists and get capacity info
    const { data: event, error: eventError } = await adminClient
      .from("events")
      .select("id, capacity, tickets, reserved")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    // Check if event is at capacity
    const ticketsSold = event.tickets ?? event.reserved ?? 0;
    if (event.capacity && ticketsSold >= event.capacity) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_CAPACITY_EXCEEDED },
        { status: 400 },
      );
    }

    // Check if user already has a ticket for this event
    const { data: existingTicket } = await adminClient
      .from("tickets")
      .select("id")
      .eq("event_id", event_id)
      .eq("email", user.email)
      .eq("status", "VALID")
      .single();

    if (existingTicket) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_ALREADY_HAS_TICKET },
        { status: 400 },
      );
    }

    // Get referral from cookie if available
    const cookieStore = await cookies();
    const referral = cookieStore.get("referral")?.value || null;

    // Create the ticket
    const { error: insertError } = await adminClient.from("tickets").insert({
      event_id,
      email: user.email,
      referral,
      status: "VALID",
    });

    if (insertError) {
      console.error("Ticket insert error:", insertError);
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: TICKET_MESSAGES.SUCCESS,
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
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
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
      .eq("status", "VALID")
      .single();

    if (!existingTicket) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_NO_TICKET },
        { status: 400 },
      );
    }

    // Delete the ticket (soft delete by setting status or hard delete)
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

