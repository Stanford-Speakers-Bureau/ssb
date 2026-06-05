import { NextResponse } from "next/server";
import {
  verifyAdminOrScannerRequest,
  getDisplayNameForEmail,
  getSessionUser,
} from "@/app/lib/auth";
import { db, eq, and, events, tickets } from "@ssb/db";
import { isValidEmail } from "@/app/lib/validation";
import { sendVIPScanNotification } from "@/app/lib/email";
import { pushWalletUpdate } from "@/app/lib/wallet-push";

async function resolveTicketUserName(
  email: string | null,
  name: string | null,
): Promise<string | null> {
  if (name) {
    return name;
  }

  if (!email) {
    return null;
  }

  try {
    return await getDisplayNameForEmail(email);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminOrScannerRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { ticket_id, emailSUNET, event_id } = body as {
      ticket_id?: string;
      emailSUNET?: string;
      event_id?: string;
    };

    if (!ticket_id && !emailSUNET && !event_id) {
      return NextResponse.json(
        {
          error:
            "Missing required field: ticket_id and emailSUNET and event_id",
        },
        { status: 400 },
      );
    }

    // Get scanner's user information
    const scannerUser = await getSessionUser();
    const scannerEmail = scannerUser?.email || null;
    const scannerName = scannerUser?.displayName || null;

    // Check if there's a live event
    const liveEvent = await db.query.events.findFirst({
      where: eq(events.live, true),
      columns: { id: true, name: true, allowAdmittingStandby: true },
    });

    if (!liveEvent) {
      return NextResponse.json(
        {
          error: "No event is currently live. Scanning is disabled.",
          status: "invalid",
        },
        { status: 400 },
      );
    }

    let ticket: {
      id: string;
      type: string;
      scanned: boolean;
      scanTime: Date | null;
      email: string;
      name: string | null;
      eventId: string | null;
      scanUser: string | null;
      scanEmail: string | null;
    } | null = null;

    if (ticket_id) {
      ticket =
        (await db.query.tickets.findFirst({
          where: eq(tickets.id, ticket_id),
          columns: {
            id: true,
            type: true,
            scanned: true,
            scanTime: true,
            email: true,
            name: true,
            eventId: true,
            scanUser: true,
            scanEmail: true,
          },
        })) ?? null;
    } else if (emailSUNET) {
      const email = !isValidEmail(emailSUNET)
        ? `${emailSUNET}@stanford.edu`
        : emailSUNET;

      ticket =
        (await db.query.tickets.findFirst({
          where: and(eq(tickets.email, email), eq(tickets.eventId, event_id!)),
          columns: {
            id: true,
            type: true,
            scanned: true,
            scanTime: true,
            email: true,
            name: true,
            eventId: true,
            scanUser: true,
            scanEmail: true,
          },
        })) ?? null;
    }

    if (!ticket) {
      return NextResponse.json(
        { error: "Invalid ticket", status: "invalid" },
        { status: 404 },
      );
    }

    // Check if ticket belongs to the live event
    if (ticket.eventId !== liveEvent.id) {
      return NextResponse.json(
        {
          error: `This ticket is for a different event. Only tickets for "${liveEvent.name}" can be scanned.`,
          status: "invalid",
        },
        { status: 400 },
      );
    }

    const userName = await resolveTicketUserName(ticket.email, ticket.name);

    // Standby admission is gated per-event. Until the admin opens it up, standby
    // guests aren't admitted *yet* — hold them rather than waving them through.
    if (
      ticket.type?.toLowerCase().trim() === "standby" &&
      !liveEvent.allowAdmittingStandby
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Standby isn't being admitted yet for this event.",
          status: "standby_blocked",
          ticket: {
            id: ticket.id,
            type: ticket.type,
            scanned: ticket.scanned,
            scan_time: ticket.scanTime?.toISOString() ?? null,
            email: ticket.email,
            name: userName,
            scan_user: ticket.scanUser,
            scan_email: ticket.scanEmail,
          },
        },
        { status: 200 },
      );
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
            scan_time: ticket.scanTime?.toISOString() ?? null,
            email: ticket.email,
            name: userName,
            scan_user: ticket.scanUser,
            scan_email: ticket.scanEmail,
          },
        },
        { status: 200 },
      );
    }

    // Update ticket: set scanned to true and scan_time to current timestamp
    const now = new Date();
    const scanTime = now.toISOString();

    const [updatedTicket] = await db
      .update(tickets)
      .set({
        scanned: true,
        scanTime: now,
        scanUser: scannerName,
        scanEmail: scannerEmail,
      })
      .where(eq(tickets.id, ticket.id))
      .returning({
        id: tickets.id,
        type: tickets.type,
        scanned: tickets.scanned,
        scanTime: tickets.scanTime,
        email: tickets.email,
        scanUser: tickets.scanUser,
        scanEmail: tickets.scanEmail,
      });

    // Note: Event scanned count is automatically incremented by database trigger
    // when ticket.scanned is set to true (auto_increment_event_scanned)

    // Send VIP scan notification email if ticket is VIP
    if (updatedTicket.type?.toUpperCase() === "VIP") {
      try {
        await sendVIPScanNotification({
          attendeeEmail: updatedTicket.email || "",
          attendeeName: userName,
          eventName: liveEvent.name || "Event",
          ticketId: updatedTicket.id,
          scanTime: scanTime,
          scannerName: scannerName,
          scannerEmail: scannerEmail,
        });
      } catch (emailError) {
        // Log error but don't fail the scan request
        console.error("Error sending VIP scan notification email:", emailError);
      }
    }

    // Push the live "Checked In" state to the attendee's Apple Wallet pass.
    // Bumps wallet_updated_at and fires an APNs refresh; best-effort so it
    // never fails the scan (the pass also picks the change up on next poll).
    await pushWalletUpdate([updatedTicket.id], {
      actor: scannerEmail ?? "scanner",
      reason: "ticket scanned",
      eventId: liveEvent.id,
      eventName: liveEvent.name,
      targetEmail: updatedTicket.email,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Ticket scanned successfully",
        status: "scanned",
        ticket: {
          id: updatedTicket.id,
          type: updatedTicket.type,
          scanned: updatedTicket.scanned,
          scan_time: updatedTicket.scanTime?.toISOString() ?? null,
          email: updatedTicket.email,
          name: userName,
          scan_user: updatedTicket.scanUser,
          scan_email: updatedTicket.scanEmail,
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
    const emailSUNET = searchParams.get("emailSUNET");
    const event_id = searchParams.get("event_id");

    if (!ticket_id && !(emailSUNET && event_id)) {
      return NextResponse.json(
        {
          error:
            "Missing required parameter: ticket_id or (emailSUNET + event_id)",
        },
        { status: 400 },
      );
    }

    // Check if there's a live event
    const liveEvent = await db.query.events.findFirst({
      where: eq(events.live, true),
      columns: { id: true, name: true },
    });

    if (!liveEvent) {
      return NextResponse.json(
        {
          error: "No event is currently live. Scanning is disabled.",
          status: "invalid",
        },
        { status: 400 },
      );
    }

    // Get ticket status without updating it
    let ticket: {
      id: string;
      type: string;
      scanned: boolean;
      scanTime: Date | null;
      email: string;
      name: string | null;
      eventId: string | null;
      scanUser: string | null;
      scanEmail: string | null;
    } | null = null;

    if (ticket_id) {
      ticket =
        (await db.query.tickets.findFirst({
          where: eq(tickets.id, ticket_id),
          columns: {
            id: true,
            type: true,
            scanned: true,
            scanTime: true,
            email: true,
            name: true,
            eventId: true,
            scanUser: true,
            scanEmail: true,
          },
        })) ?? null;
    } else if (emailSUNET) {
      const email = !isValidEmail(emailSUNET)
        ? `${emailSUNET}@stanford.edu`
        : emailSUNET;

      ticket =
        (await db.query.tickets.findFirst({
          where: and(eq(tickets.email, email), eq(tickets.eventId, event_id!)),
          columns: {
            id: true,
            type: true,
            scanned: true,
            scanTime: true,
            email: true,
            name: true,
            eventId: true,
            scanUser: true,
            scanEmail: true,
          },
        })) ?? null;
    }

    if (!ticket) {
      return NextResponse.json(
        { error: "Invalid ticket", status: "invalid" },
        { status: 404 },
      );
    }

    // Check if ticket belongs to the live event
    if (ticket.eventId !== liveEvent.id) {
      return NextResponse.json(
        {
          error: `This ticket is for a different event. Only tickets for "${liveEvent.name}" can be scanned.`,
          status: "invalid",
        },
        { status: 400 },
      );
    }

    const userName = await resolveTicketUserName(ticket.email, ticket.name);

    // Return ticket status
    if (ticket.scanned) {
      return NextResponse.json(
        {
          status: "already_scanned",
          ticket: {
            id: ticket.id,
            type: ticket.type,
            scanned: ticket.scanned,
            scan_time: ticket.scanTime?.toISOString() ?? null,
            email: ticket.email,
            name: userName,
            scan_user: ticket.scanUser,
            scan_email: ticket.scanEmail,
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
          scan_time: ticket.scanTime?.toISOString() ?? null,
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
