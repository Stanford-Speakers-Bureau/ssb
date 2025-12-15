import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSupabaseClient,
  updateReferralRecords,
} from "../../lib/supabase";
import { generateReferralCode } from "../../lib/utils";
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
  ERROR_LIVE_EVENT: "Cannot cancel tickets while an event is live.",
  ERROR_EVENT_STARTED:
    "Ticket sales have ended. This event has already started.",
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

    // Check if event has started - block ticket sales if it has
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

    // If event has a start time and it has passed, block ticket sales
    // Note: event.start_time_date is stored as UTC ISO string, and Date objects
    // compare UTC timestamps internally, so this comparison is timezone-safe
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

    // Validate referral code if provided
    if (referral) {
      const userReferralCode = generateReferralCode(user.email);

      // Check if it's the user's own referral code
      if (referral.trim() === userReferralCode) {
        return NextResponse.json(
          { error: "You cannot use your own referral code" },
          { status: 400 },
        );
      }

      // Check if the referral code exists for this event
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
    const { data: ticket } = await adminClient
      .from("tickets")
      .select("id")
      .eq("event_id", event_id)
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Update referral records (non-blocking - don't fail ticket creation if this fails)
    await updateReferralRecords(event_id, user.email);

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

// commenting this out for now
// export async function DELETE(req: Request) {
//   try {
//     const supabase = await createServerSupabaseClient();
//
//     // Get current user
//     const {
//       data: { user },
//       error: userError,
//     } = await supabase.auth.getUser();
//
//     if (userError || !user?.email) {
//       return NextResponse.json(
//         { error: TICKET_MESSAGES.ERROR_NOT_AUTHENTICATED },
//         { status: 401 },
//       );
//     }
//
//     // Parse request body
//     let body;
//     try {
//       body = await req.json();
//     } catch {
//       return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
//     }
//
//     const { event_id } = body;
//
//     if (!event_id || typeof event_id !== "string") {
//       return NextResponse.json(
//         { error: TICKET_MESSAGES.ERROR_MISSING_EVENT_ID },
//         { status: 400 },
//       );
//     }
//
//     const adminClient = getSupabaseClient();
//
//     // Check if there's a live event - prevent cancellation if any event is live
//     const { data: liveEvent } = await adminClient
//       .from("events")
//       .select("id, name")
//       .eq("live", true)
//       .single();
//
//     if (liveEvent) {
//       return NextResponse.json(
//         { error: TICKET_MESSAGES.ERROR_LIVE_EVENT },
//         { status: 400 },
//       );
//     }
//
//     // Check if user has a ticket for this event
//     const { data: existingTicket } = await adminClient
//       .from("tickets")
//       .select("id")
//       .eq("event_id", event_id)
//       .eq("email", user.email)
//       .single();
//
//     if (!existingTicket) {
//       return NextResponse.json(
//         { error: TICKET_MESSAGES.ERROR_NO_TICKET },
//         { status: 400 },
//       );
//     }
//
//     // Delete the ticket (hard delete)
//     const { error: deleteError } = await adminClient
//       .from("tickets")
//       .delete()
//       .eq("id", existingTicket.id);
//
//     if (deleteError) {
//       console.error("Ticket delete error:", deleteError);
//       return NextResponse.json(
//         { error: TICKET_MESSAGES.ERROR_GENERIC },
//         { status: 500 },
//       );
//     }
//
//     return NextResponse.json(
//       {
//         success: true,
//         message: TICKET_MESSAGES.DELETED,
//       },
//       { status: 200 },
//     );
//   } catch (error) {
//     console.error("Ticket deletion error:", error);
//     return NextResponse.json(
//       { error: TICKET_MESSAGES.ERROR_GENERIC },
//       { status: 500 },
//     );
//   }
// }
