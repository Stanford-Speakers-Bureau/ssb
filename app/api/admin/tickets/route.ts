import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/app/lib/supabase";

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

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

    // Get total count for pagination
    let countQuery = adminClient
      .from("tickets")
      .select("id", { count: "exact", head: true });
    if (eventId) {
      countQuery = countQuery.eq("event_id", eventId);
    }
    const { count } = await countQuery;

    return NextResponse.json({
      tickets: tickets || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Tickets fetch error:", error);
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

    // Delete the ticket
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

export async function PATCH(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { id, action } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 },
      );
    }

    if (action !== "unscan") {
      return NextResponse.json(
        { error: "Invalid action. Use 'unscan' to unscan a ticket." },
        { status: 400 },
      );
    }

    const adminClient = auth.adminClient!;

    // Unscan the ticket: set scanned to false and clear scan-related fields
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
  } catch (error) {
    console.error("Ticket unscan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { email, eventId, type } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
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

    // Create the VIP ticket
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
          start_time_date
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

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error("Ticket creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
