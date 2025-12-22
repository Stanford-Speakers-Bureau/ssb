import { NextResponse } from "next/server";
import {
  verifyAdminOrScannerRequest,
  createServerSupabaseClient,
} from "@/app/lib/supabase";
import {isValidEmail} from "@/app/lib/validation";

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminOrScannerRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { ticket_id, emailSUNET, event_id } = body;

    if (!ticket_id && !emailSUNET && !event_id) {
      return NextResponse.json(
        { error: "Missing required field: ticket_id and emailSUNET and event_id" },
        { status: 400 },
      );
    }
    const adminClient = auth.adminClient!;

    // Get scanner's user information
    const supabase = await createServerSupabaseClient();
    const {
      data: { user: scannerUser },
    } = await supabase.auth.getUser();
    const scannerEmail = scannerUser?.email || null;
    let scannerName: string | null = null;
    if (scannerUser?.user_metadata) {
      scannerName =
        scannerUser.user_metadata.full_name ||
        scannerUser.user_metadata.name ||
        scannerUser.user_metadata.display_name ||
        null;
    }

    // Check if there's a live event
    const { data: liveEvent, error: liveEventError } = await adminClient
      .from("events")
      .select("id, name")
      .eq("live", true)
      .single();

    if (liveEventError || !liveEvent) {
      return NextResponse.json(
        {
          error: "No event is currently live. Scanning is disabled.",
          status: "invalid",
        },
        { status: 400 },
      );
    }

    let ticket: any = null;
    let fetchError: any = null;

    const selectFields =
      "id, type, scanned, scan_time, email, event_id, scan_user, scan_email";

    if (ticket_id) {
      const res = await adminClient
        .from("tickets")
        .select(selectFields)
        .eq("id", ticket_id)
        .single();
      ticket = res.data;
      fetchError = res.error;
    } else if (emailSUNET) {
      const email = !isValidEmail(emailSUNET) ? `${emailSUNET}@stanford.edu` : emailSUNET;

      const res = await adminClient
        .from("tickets")
        .select(selectFields)
        .eq("email", email)
        .eq("event_id", event_id)
        .single();
      ticket = res.data;
      fetchError = res.error;
    }
    // don't need else here since we did a check above

    if (fetchError || !ticket) {
      return NextResponse.json(
        { error: "Invalid ticket", status: "invalid" },
        { status: 404 },
      );
    }

    // Check if ticket belongs to the live event
    if (ticket.event_id !== liveEvent.id) {
      return NextResponse.json(
        {
          error: `This ticket is for a different event. Only tickets for "${liveEvent.name}" can be scanned.`,
          status: "invalid",
        },
        { status: 400 },
      );
    }

    // Get user information from auth if email exists
    let userName: string | null = null;
    if (ticket.email) {
      try {
        // Use listUsers to find user by email
        const { data: usersList, error: authError } =
          await adminClient.auth.admin.listUsers();
        if (!authError && usersList?.users) {
          const user = usersList.users.find((u) => u.email === ticket.email);
          if (user?.user_metadata) {
            if (user.user_metadata.full_name) {
              userName = user.user_metadata.full_name;
            } else if (user.user_metadata.name) {
              userName = user.user_metadata.name;
            } else if (user.user_metadata.display_name) {
              userName = user.user_metadata.display_name;
            }
          }
        }
      } catch (err) {
        // If we can't get user info, continue without it
        console.error("Error fetching user info:", err);
      }
    }

    // If already scanned, return that status
    if (ticket.scanned) {
      return NextResponse.json(
        {
          success: false,
          message: "Ticket already scanned",
          status: "already_scanned",
          ticket: {
            id: ticket.id,
            type: ticket.type,
            scanned: ticket.scanned,
            scan_time: ticket.scan_time,
            email: ticket.email,
            name: userName,
            scan_user: ticket.scan_user,
            scan_email: ticket.scan_email,
          },
        },
        { status: 200 },
      );
    }

    // Update ticket: set scanned to true and scan_time to current timestamp
    // Use local timezone-aware timestamp
    const now = new Date();
    const scanTime = now.toISOString();

    const { data: updatedTicket, error: updateError } = await adminClient
      .from("tickets")
      .update({
        scanned: true,
        scan_time: scanTime,
        scan_user: scannerName,
        scan_email: scannerEmail,
      })
      .eq("id", ticket.id)
      .select("id, type, scanned, scan_time, email, scan_user, scan_email")
      .single();

    if (updateError) {
      console.error("Ticket scan update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update ticket" },
        { status: 500 },
      );
    }

    // Increment the event's scanned count
    const { error: eventUpdateError } = await adminClient.rpc(
      "increment_event_scanned",
      {
        event_id: liveEvent.id,
      },
    );

    if (eventUpdateError) {
      console.error("Failed to update event scanned count:", eventUpdateError);
      // Don't fail the scan if count update fails, but log it
    }

    // Get user information for the response
    let userNameResponse: string | null = null;
    if (updatedTicket.email) {
      try {
        // Use listUsers to find user by email
        const { data: usersList, error: authError } =
          await adminClient.auth.admin.listUsers();
        if (!authError && usersList?.users) {
          const user = usersList.users.find(
            (u) => u.email === updatedTicket.email,
          );
          if (user?.user_metadata) {
            if (user.user_metadata.full_name) {
              userNameResponse = user.user_metadata.full_name;
            } else if (user.user_metadata.name) {
              userNameResponse = user.user_metadata.name;
            } else if (user.user_metadata.display_name) {
              userNameResponse = user.user_metadata.display_name;
            }
          }
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Ticket scanned successfully",
        status: "scanned",
        ticket: {
          ...updatedTicket,
          name: userNameResponse,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Ticket scan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminOrScannerRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const ticket_id = searchParams.get("ticket_id");

    if (!ticket_id) {
      return NextResponse.json(
        { error: "Missing required parameter: ticket_id" },
        { status: 400 },
      );
    }

    const adminClient = auth.adminClient!;

    // Check if there's a live event
    const { data: liveEvent, error: liveEventError } = await adminClient
      .from("events")
      .select("id, name")
      .eq("live", true)
      .single();

    if (liveEventError || !liveEvent) {
      return NextResponse.json(
        {
          error: "No event is currently live. Scanning is disabled.",
          status: "invalid",
        },
        { status: 400 },
      );
    }

    // Get ticket status without updating it
    const { data: ticket, error: fetchError } = await adminClient
      .from("tickets")
      .select(
        "id, type, scanned, scan_time, email, event_id, scan_user, scan_email",
      )
      .eq("id", ticket_id)
      .single();

    if (fetchError || !ticket) {
      return NextResponse.json(
        { error: "Invalid ticket", status: "invalid" },
        { status: 404 },
      );
    }

    // Check if ticket belongs to the live event
    if (ticket.event_id !== liveEvent.id) {
      return NextResponse.json(
        {
          error: `This ticket is for a different event. Only tickets for "${liveEvent.name}" can be scanned.`,
          status: "invalid",
        },
        { status: 400 },
      );
    }

    // Get user information
    let userName: string | null = null;
    if (ticket.email) {
      try {
        // Use listUsers to find user by email
        const { data: usersList, error: authError } =
          await adminClient.auth.admin.listUsers();
        if (!authError && usersList?.users) {
          const user = usersList.users.find((u) => u.email === ticket.email);
          if (user?.user_metadata) {
            if (user.user_metadata.full_name) {
              userName = user.user_metadata.full_name;
            } else if (user.user_metadata.name) {
              userName = user.user_metadata.name;
            } else if (user.user_metadata.display_name) {
              userName = user.user_metadata.display_name;
            }
          }
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
      }
    }

    // Return ticket status
    if (ticket.scanned) {
      return NextResponse.json(
        {
          status: "already_scanned",
          ticket: {
            id: ticket.id,
            type: ticket.type,
            scanned: ticket.scanned,
            scan_time: ticket.scan_time,
            email: ticket.email,
            name: userName,
            scan_user: ticket.scan_user,
            scan_email: ticket.scan_email,
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        status: "valid",
        ticket: {
          id: ticket.id,
          type: ticket.type,
          scanned: ticket.scanned,
          scan_time: ticket.scan_time,
          email: ticket.email,
          name: userName,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Ticket status check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
