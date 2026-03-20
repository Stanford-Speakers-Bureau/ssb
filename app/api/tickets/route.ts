import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  updateReferralRecords,
  getAvailablePublicTickets,
  isEventUnderCapacity,
} from "@/app/lib/supabase";
import { isEventOver } from "@/app/lib/eventTime";
import {
  db,
  eq,
  and,
  sql,
  events,
  tickets,
  referrals,
  waitlist,
} from "@ssb/db";
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
  ERROR_EVENT_STARTED_OR_ENDED:
    "Cannot cancel tickets after the event has started.",
  ERROR_EVENT_STARTED:
    "Ticket sales have ended. This event has already started.",
  ERROR_TICKETING_NOT_OPEN:
    "Ticketing is not open yet for this event. Please check back later.",
  ERROR_STANDBY_ONLY:
    "The standby line is open. Standard tickets are no longer available online.",
  ERROR_NAME_REQUIRED:
    "A name is required for your ticket. If you see this error, please email tickets@stanfordspeakersbureau.com.",
} as const;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || searchParams.get("event_id");
    const count = searchParams.get("count");

    // 1. Handle Public Ticket Count
    if (count === "true" && eventId) {
      try {
        // Use unified helper function to get accurate public ticket count
        // This excludes VIP tickets and handles overflow logic
        const ticketInfo = await getAvailablePublicTickets(eventId);

        return NextResponse.json(
          {
            count: ticketInfo.publicSold, // Public tickets sold (for display)
            available: ticketInfo.available, // Tickets still available for public
            maxPublic: ticketInfo.maxPublic, // Total public capacity
            vipCount: ticketInfo.vipCount, // VIP tickets (for debugging/admin)
          },
          { status: 200 },
        );
      } catch (error) {
        console.error("Ticket count error:", error);
        return NextResponse.json(
          { error: "Failed to fetch ticket count" },
          { status: 500 },
        );
      }
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

    const userTickets = await db.query.tickets.findMany({
      where: eq(tickets.email, user.email),
      columns: {
        id: true,
        eventId: true,
        createdAt: true,
        type: true,
        name: true,
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
      orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
    });

    // Transform to match expected API shape (snake_case)
    const serializedTickets = userTickets.map((t) => ({
      id: t.id,
      event_id: t.eventId,
      created_at: t.createdAt.toISOString(),
      type: t.type,
      name: t.name,
      events: t.event
        ? {
            id: t.event.id,
            name: t.event.name,
            route: t.event.route,
            start_time_date: t.event.startTimeDate?.toISOString() ?? null,
            venue: t.event.venue,
          }
        : null,
    }));

    return NextResponse.json(
      {
        tickets: serializedTickets,
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
    // Extract name from Google OAuth metadata (required for create_ticket_with_name)
    const userName: string | null =
      user?.user_metadata?.full_name || user?.user_metadata?.name || null;

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

    const {
      event_id,
      referral: referralFromBody,
      type: ticketType,
    } = body as {
      event_id?: string;
      referral?: string;
      type?: string;
    };

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

    const event = await db.query.events.findFirst({
      where: eq(events.id, event_id),
      columns: {
        startTimeDate: true,
        endTimeDate: true,
        releaseDate: true,
        ticketingDate: true,
        doorsOpen: true,
        standbyEnabled: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    // Enforce ticketing open date:
    // - Prefer ticketing_date
    // - Fall back to release_date when ticketing_date is null (keeps current behavior)
    // - Skip entirely when LOCAL_TICKETING_ENABLED is set (local development)
    if (process.env.LOCAL_TICKETING_ENABLED !== "true") {
      const effectiveTicketingDate =
        event.ticketingDate ?? event.releaseDate ?? null;

      if (effectiveTicketingDate) {
        const now = new Date();
        if (now < effectiveTicketingDate) {
          return NextResponse.json(
            { error: TICKET_MESSAGES.ERROR_TICKETING_NOT_OPEN },
            { status: 400 },
          );
        }
      }
    }

    if (isEventOver({ endTime: event.endTimeDate, startTime: event.startTimeDate })) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_EVENT_STARTED },
        { status: 400 },
      );
    }

    // --- STANDBY TICKET: issued when standby mode is enabled by admin ---
    if (ticketType === "STANDBY") {
      // Verify standby mode is enabled
      if (!event.standbyEnabled) {
        return NextResponse.json(
          {
            error:
              "Standby tickets are only available when standby mode is enabled.",
          },
          { status: 400 },
        );
      }

      // Check user doesn't already have a ticket (any type)
      const existingTicket = await db.query.tickets.findFirst({
        where: and(
          eq(tickets.eventId, event_id),
          eq(tickets.email, user.email),
        ),
        columns: { id: true },
      });

      if (existingTicket) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_ALREADY_HAS_TICKET },
          { status: 400 },
        );
      }

      const existingWaitlistEntry = await db.query.waitlist.findFirst({
        where: and(
          eq(waitlist.eventId, event_id),
          eq(waitlist.email, user.email),
        ),
        columns: { id: true, referral: true },
      });

      const nameForTicket = userName?.trim();
      if (!nameForTicket) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_NAME_REQUIRED },
          { status: 400 },
        );
      }

      // Insert directly, bypassing the capacity-checking stored procedure
      const [standbyTicket] = await db
        .insert(tickets)
        .values({
          eventId: event_id,
          email: user.email,
          name: nameForTicket,
          type: "STANDBY",
          referral: referral ?? existingWaitlistEntry?.referral ?? null,
        })
        .returning({
          id: tickets.id,
          email: tickets.email,
          type: tickets.type,
          name: tickets.name,
          eventId: tickets.eventId,
        });

      // Get event details for email
      const eventForEmail = standbyTicket?.eventId
        ? await db.query.events.findFirst({
            where: eq(events.id, standbyTicket.eventId),
            columns: {
              id: true,
              name: true,
              route: true,
              startTimeDate: true,
              endTimeDate: true,
              venue: true,
              venueLink: true,
              desc: true,
              doorsOpen: true,
            },
          })
        : null;

      if (existingWaitlistEntry) {
        try {
          await db.delete(waitlist).where(eq(waitlist.id, existingWaitlistEntry.id));
        } catch (waitlistDeleteError) {
          console.error("Standby waitlist cleanup error:", waitlistDeleteError);
        }
      }

      if (referral || existingWaitlistEntry?.referral) {
        await updateReferralRecords(event_id, user.email);
      }

      // Send ticket confirmation email
      if (standbyTicket) {
        try {
          await sendTicketEmail({
            name: nameForTicket,
            email: standbyTicket.email,
            eventName: eventForEmail?.name || "Event",
            ticketType: "STANDBY",
            eventStartTime: eventForEmail?.startTimeDate?.toISOString() || null,
            eventEndTime: eventForEmail?.endTimeDate?.toISOString() || null,
            eventRoute: eventForEmail?.route || null,
            ticketId: standbyTicket.id,
            eventVenue: eventForEmail?.venue || null,
            eventVenueLink: eventForEmail?.venueLink || null,
            eventDescription: eventForEmail?.desc || null,
            doorsOpenTime: eventForEmail?.doorsOpen?.toISOString() || null,
          });
        } catch (emailError) {
          console.error("Standby ticket email error:", emailError);
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
          ticketId: standbyTicket?.id ?? null,
          ticketName: standbyTicket?.name ?? nameForTicket ?? null,
        },
        { status: 200 },
      );
    }

    if (event.standbyEnabled) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_STANDBY_ONLY },
        { status: 400 },
      );
    }

    if (referral) {
      const userReferralCode = generateReferralCode(user.email);
      if (referral.trim().toLowerCase() === userReferralCode) {
        return NextResponse.json(
          { error: "You cannot use your own referral code" },
          { status: 400 },
        );
      }

      const referralRecord = await db.query.referrals.findFirst({
        where: and(
          eq(referrals.eventId, event_id),
          eq(referrals.referralCode, referral.trim().toLowerCase()),
        ),
        columns: { id: true },
      });

      if (!referralRecord) {
        return NextResponse.json(
          { error: "Invalid referral code for this event" },
          { status: 400 },
        );
      }
    }

    const nameForTicket = userName?.trim();
    if (!nameForTicket) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_NAME_REQUIRED },
        { status: 400 },
      );
    }

    // Call stored procedure via raw SQL (atomic ticket creation with FOR UPDATE locking)
    let rpcData: unknown = null;
    try {
      const result = await db.execute<{ create_ticket_with_name: unknown }>(sql`
        SELECT create_ticket_with_name(
          ${event_id}::uuid,
          ${referral},
          ${nameForTicket},
          ${user.email}
        )
      `);
      rpcData = result[0]?.create_ticket_with_name ?? null;
    } catch (rpcError: unknown) {
      const msg = getErrorMessage(rpcError).toLowerCase();
      if (msg.includes("does not exist") && msg.includes("function")) {
        console.error("Ticket RPC missing:", rpcError);
        return NextResponse.json(
          {
            error:
              "Ticket creation RPC is not installed in the database (create_ticket_with_name).",
          },
          { status: 500 },
        );
      }
      if (msg.includes("capacity")) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_CAPACITY_EXCEEDED },
          { status: 400 },
        );
      }
      if (msg.includes("already")) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_ALREADY_HAS_TICKET },
          { status: 400 },
        );
      }
      if (msg.includes("event_not_found")) {
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

    const ticket = await db.query.tickets.findFirst({
      where: and(eq(tickets.eventId, event_id), eq(tickets.email, user.email)),
      columns: {
        id: true,
        email: true,
        type: true,
        name: true,
        eventId: true,
      },
      with: {
        event: {
          columns: {
            id: true,
            name: true,
            route: true,
            startTimeDate: true,
            endTimeDate: true,
            venue: true,
            venueLink: true,
            desc: true,
            doorsOpen: true,
          },
        },
      },
      orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
    });

    await updateReferralRecords(event_id, user.email);

    if (ticket) {
      try {
        await sendTicketEmail({
          name: nameForTicket,
          email: ticket.email,
          eventName: ticket.event?.name || "Event",
          ticketType: ticket.type || "STANDARD",
          eventStartTime: ticket.event?.startTimeDate?.toISOString() || null,
          eventEndTime: ticket.event?.endTimeDate?.toISOString() || null,
          eventRoute: ticket.event?.route || null,
          ticketId: ticket.id,
          eventVenue: ticket.event?.venue || null,
          eventVenueLink: ticket.event?.venueLink || null,
          eventDescription: ticket.event?.desc || null,
          doorsOpenTime: ticket.event?.doorsOpen?.toISOString() || null,
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
        ticketName: ticket?.name ?? nameForTicket ?? null,
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

    const { event_id } = body as { event_id?: string };

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_MISSING_EVENT_ID },
        { status: 400 },
      );
    }

    // Check if event is over
    const eventRow = await db.query.events.findFirst({
      where: eq(events.id, event_id),
      columns: { id: true, startTimeDate: true, endTimeDate: true, standbyEnabled: true },
    });

    if (isEventOver({ endTime: eventRow?.endTimeDate, startTime: eventRow?.startTimeDate })) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_EVENT_STARTED_OR_ENDED },
        { status: 400 },
      );
    }

    // Check if user has a ticket for this event
    const existingTicket = await db.query.tickets.findFirst({
      where: and(eq(tickets.eventId, event_id), eq(tickets.email, user.email)),
      columns: { id: true, scanned: true },
    });

    if (existingTicket?.scanned) {
      return NextResponse.json(
        { error: "Cannot cancel a ticket that has already been scanned." },
        { status: 400 },
      );
    }

    if (!existingTicket) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_NO_TICKET },
        { status: 400 },
      );
    }

    // Delete the ticket
    await db.delete(tickets).where(eq(tickets.id, existingTicket.id));

    // Once standby mode is open, freed spots should be handled by the in-person standby line.
    if (!eventRow?.standbyEnabled) {
      // Pull the top person off the waitlist (if any) only if under capacity
      const topWaitlistEntry = await db.query.waitlist.findFirst({
        where: eq(waitlist.eventId, event_id),
        orderBy: (waitlist, { asc }) => [asc(waitlist.position)],
        columns: { email: true, referral: true, eventId: true, name: true },
      });

      if (topWaitlistEntry && (await isEventUnderCapacity(event_id))) {
        // Create ticket for the waitlist person (transfer name from waitlist)
        const [newTicket] = await db
          .insert(tickets)
          .values({
            eventId: topWaitlistEntry.eventId,
            email: topWaitlistEntry.email,
            name: topWaitlistEntry.name ?? null,
            type: "STANDARD",
          })
          .returning({
            id: tickets.id,
            email: tickets.email,
            type: tickets.type,
            eventId: tickets.eventId,
          });

        // Get event details for email
        const eventForEmail = newTicket.eventId
          ? await db.query.events.findFirst({
              where: eq(events.id, newTicket.eventId),
              columns: {
                id: true,
                name: true,
                route: true,
                startTimeDate: true,
                endTimeDate: true,
                venue: true,
                venueLink: true,
                desc: true,
                doorsOpen: true,
              },
            })
          : null;

        // Remove them from the waitlist
        await db
          .delete(waitlist)
          .where(
            and(
              eq(waitlist.email, topWaitlistEntry.email),
              eq(waitlist.eventId, event_id),
            ),
          );

        // Update referral records if they had a referral code
        if (topWaitlistEntry.referral) {
          await updateReferralRecords(event_id, topWaitlistEntry.email);
        }

        // Send ticket email to the waitlist person
        if (newTicket) {
          try {
            await sendTicketEmail({
              email: newTicket.email,
              name: topWaitlistEntry.name ?? null,
              eventName: eventForEmail?.name || "Event",
              ticketType: newTicket.type || "STANDARD",
              eventStartTime:
                eventForEmail?.startTimeDate?.toISOString() || null,
              eventEndTime:
                eventForEmail?.endTimeDate?.toISOString() || null,
              eventRoute: eventForEmail?.route || null,
              ticketId: newTicket.id,
              eventVenue: eventForEmail?.venue || null,
              eventVenueLink: eventForEmail?.venueLink || null,
              eventDescription: eventForEmail?.desc || null,
              doorsOpenTime: eventForEmail?.doorsOpen?.toISOString() || null,
            });
            console.log(
              `Ticket created for waitlist user ${topWaitlistEntry.email}`,
            );
          } catch (emailError) {
            console.error(
              "Error sending ticket email to waitlist user:",
              emailError,
            );
            // Don't fail the cancellation if email fails
          }
        }
      }
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
