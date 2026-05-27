import { after, NextResponse } from "next/server";
import {
  updateReferralRecords,
  getAvailablePublicTickets,
} from "@/app/lib/supabase";
import { getRoleNamesForEmail, getSessionUser } from "@/app/lib/auth";
import { isEventOver } from "@/app/lib/eventTime";
import { db, eq, and, sql, events, tickets, waitlist } from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";
import {
  recordMailingListMember,
  type MailingListSource,
} from "@/app/lib/mailing-list";
import { verifyCancellationToken } from "@/app/lib/cancellation-links";
import { checkRateLimit, ticketRatelimit } from "@/app/lib/ratelimit";
import {
  type CancellationEmailData,
  type TicketEmailData,
} from "@/app/lib/email";
import {
  createCancellationEmailJob,
  createTicketEmailJob,
  enqueueEmailJob,
  processEmailJob,
} from "@/app/lib/email-jobs";
import {
  sanitizeStoredReferral,
  validateReferralInput,
} from "@/app/lib/referrals";
import {
  getRoleIneligiblePayload,
  isTicketingEligible,
  resolveTicketingRoles,
} from "@/app/lib/ticketingRoles";

const TICKET_MESSAGES = {
  SUCCESS: "Your ticket is confirmed. Check your email in a moment.",
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
    "Cannot cancel tickets after the event has ended.",
  ERROR_EVENT_STARTED: "Ticket sales have ended. This event is over.",
  ERROR_TICKETING_NOT_OPEN:
    "Ticketing is not open yet for this event. Please check back later.",
  ERROR_STANDBY_ONLY:
    "The standby line is open. Standard tickets are no longer available online.",
  ERROR_NAME_REQUIRED:
    "A name is required for your ticket. If you see this error, please email tickets@stanfordspeakersbureau.com.",
  ERROR_FEE_WAIVER_INELIGIBLE:
    "According to ASSU records, you are ineligible for online ticketing as your student activity fee for Stanford Speakers Bureau has been waived. Please contact ASSU for further details. We encourage you to show up to the venue early to join the standby line instead.",
} as const;

const FEE_WAIVER_ROLE = "fee_waiver";
const FEE_WAIVER_INELIGIBLE_CODE = "fee_waiver_ineligible";
const ASSU_URL = "https://assu.stanford.edu";
const ASSU_FAQ_URL = "https://www.assu.stanford.edu/m/FAQ#question-85";

function getFeeWaiverIneligiblePayload() {
  return {
    error: TICKET_MESSAGES.ERROR_FEE_WAIVER_INELIGIBLE,
    code: FEE_WAIVER_INELIGIBLE_CODE,
    assuUrl: ASSU_URL,
    faqUrl: ASSU_FAQ_URL,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function formatHeldFor(createdAt: Date | null | undefined): string | null {
  if (!createdAt) {
    return null;
  }

  const diffMs = Date.now() - createdAt.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return null;
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  if (totalMinutes < 1) {
    return "<1m";
  }

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (days === 0 && minutes > 0) {
    parts.push(`${minutes}m`);
  }

  return parts.slice(0, 2).join(" ");
}

type TicketCreationRpcResult = {
  success?: boolean;
  ticket_id?: string | null;
  email?: string | null;
  event_id?: string | null;
};

type TicketCancellationRpcResult = {
  success?: boolean;
  cancelled_ticket_id?: string | null;
  promoted?: boolean;
  promoted_ticket_id?: string | null;
  promoted_email?: string | null;
  promoted_name?: string | null;
  promoted_referral?: string | null;
  promoted_ticket_type?: string | null;
};

type TicketEmailEventContext = {
  id: string;
  name: string | null;
  route: string | null;
  startTimeDate: Date | null;
  endTimeDate: Date | null;
  venue: string | null;
  venueLink: string | null;
  desc: string | null;
  doorsOpen: Date | null;
  tagline: string | null;
  imgVersion: number | null;
};

function scheduleAfterResponse(label: string, task: () => Promise<void>) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`${label} error:`, error);
    }
  });
}

async function queueTicketEmail(params: TicketEmailData) {
  const queued = await enqueueEmailJob(createTicketEmailJob(params));
  if (queued) {
    return;
  }

  scheduleAfterResponse("Ticket email", async () => {
    await processEmailJob(createTicketEmailJob(params));
  });
}

async function queueCancellationEmail(params: CancellationEmailData) {
  const queued = await enqueueEmailJob(createCancellationEmailJob(params));
  if (queued) {
    return;
  }

  scheduleAfterResponse("Cancellation email", async () => {
    await processEmailJob(createCancellationEmailJob(params));
  });
}

function queueReferralRecordUpdate(eventId: string, userEmail: string) {
  scheduleAfterResponse("Referral record update", async () => {
    await updateReferralRecords(eventId, userEmail);
  });
}

function queueAuditEvent(params: Parameters<typeof logAuditEvent>[0]) {
  scheduleAfterResponse("Audit log", async () => {
    await logAuditEvent(params);
  });
}

function queueMailingListAdd(email: string, source: MailingListSource) {
  scheduleAfterResponse("Mailing list add", async () => {
    await recordMailingListMember({ email, source });
  });
}

function isUniqueTicketConflict(error: unknown): boolean {
  const databaseError = error as {
    code?: string;
    constraint_name?: string;
    constraint?: string;
  } | null;

  return (
    databaseError?.code === "23505" ||
    databaseError?.constraint_name === "tickets_event_email_unique" ||
    databaseError?.constraint === "tickets_event_email_unique" ||
    getErrorMessage(error).toLowerCase().includes("tickets_event_email_unique")
  );
}

function buildTicketEmailPayload(args: {
  event: TicketEmailEventContext;
  ticketId: string;
  ticketType: string;
  userEmail: string;
  userName: string | null;
}) {
  const { event, ticketId, ticketType, userEmail, userName } = args;

  return {
    name: userName,
    email: userEmail,
    eventName: event.name || "Event",
    ticketType,
    eventStartTime: event.startTimeDate?.toISOString() || null,
    eventEndTime: event.endTimeDate?.toISOString() || null,
    eventRoute: event.route || null,
    ticketId,
    eventVenue: event.venue || null,
    eventVenueLink: event.venueLink || null,
    eventDescription: event.desc || null,
    doorsOpenTime: event.doorsOpen?.toISOString() || null,
    eventId: event.id,
    imgVersion: event.imgVersion ?? null,
    eventTagline: event.tagline || null,
  };
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
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in." },
        { status: 401 },
      );
    }

    if (eventId) {
      const ticket = await db.query.tickets.findFirst({
        where: and(eq(tickets.eventId, eventId), eq(tickets.email, user.email)),
        columns: {
          id: true,
          type: true,
          name: true,
          scanned: true,
        },
      });

      return NextResponse.json(
        {
          hasTicket: !!ticket,
          ticketId: ticket?.id ?? null,
          ticketType: ticket?.type ?? null,
          ticketName: ticket?.name ?? null,
          isScanned: ticket?.scanned ?? false,
        },
        { status: 200 },
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
    const user = await getSessionUser();
    const userName: string | null = user?.displayName || null;

    // --- USER CREATE TICKET ---
    if (!user?.email) {
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

    const isStandbyRequest = ticketType === "STANDBY";
    const [event, userRoles] = await Promise.all([
      db.query.events.findFirst({
        where: eq(events.id, event_id),
        columns: {
          id: true,
          name: true,
          route: true,
          startTimeDate: true,
          endTimeDate: true,
          venue: true,
          venueLink: true,
          desc: true,
          releaseDate: true,
          ticketingDate: true,
          doorsOpen: true,
          standbyEnabled: true,
          tagline: true,
          imgVersion: true,
          referralsEnabled: true,
          ticketingRoles: true,
        },
      }),
      isStandbyRequest
        ? Promise.resolve<string[]>([])
        : getRoleNamesForEmail(user.email),
    ]);

    if (!event) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    const userAffiliations = [
      ...user.eduPersonAffiliation,
      ...user.eduPersonScopedAffiliation,
    ];

    // Standby tickets are open to anyone who shows up — we deliberately skip
    // both the ASSU fee-waiver guard and the affiliation/ticketing-role guard
    // for standby requests. Standard online ticketing still enforces both.
    if (!isStandbyRequest && userRoles.includes(FEE_WAIVER_ROLE)) {
      queueAuditEvent({
        action: "ticket.ineligible",
        actor: user.email,
        eventId: event_id,
        eventName: event.name ?? null,
        targetEmail: user.email,
        metadata: {
          attemptedType: "STANDARD",
          reason: FEE_WAIVER_ROLE,
          assuUrl: ASSU_URL,
          faqUrl: ASSU_FAQ_URL,
        },
      });

      return NextResponse.json(getFeeWaiverIneligiblePayload(), {
        status: 403,
      });
    }

    if (
      !isStandbyRequest &&
      !isTicketingEligible(userAffiliations, event.ticketingRoles)
    ) {
      const allowedRoles = resolveTicketingRoles(event.ticketingRoles);

      queueAuditEvent({
        action: "ticket.ineligible",
        actor: user.email,
        eventId: event_id,
        eventName: event.name ?? null,
        targetEmail: user.email,
        metadata: {
          attemptedType: isStandbyRequest ? "STANDBY" : "STANDARD",
          reason: "ticketing_roles",
          allowedRoles,
          userAffiliations,
        },
      });

      return NextResponse.json(getRoleIneligiblePayload(allowedRoles), {
        status: 403,
      });
    }

    const referralValidation = await validateReferralInput({
      eventId: event_id,
      referralCode: referralFromBody,
      userEmail: user.email,
      referralsEnabled: event.referralsEnabled,
    });

    if (!referralValidation.ok) {
      return NextResponse.json(
        { error: referralValidation.message },
        { status: 400 },
      );
    }

    const referral = referralValidation.referral;

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

    if (
      isEventOver({
        endTime: event.endTimeDate,
        startTime: event.startTimeDate,
      })
    ) {
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

      const existingWaitlistEntry = await db.query.waitlist.findFirst({
        where: and(
          eq(waitlist.eventId, event_id),
          eq(waitlist.email, user.email),
        ),
        columns: { referral: true },
      });

      const waitlistReferral = await sanitizeStoredReferral({
        eventId: event_id,
        referralCode: existingWaitlistEntry?.referral,
        userEmail: user.email,
        referralsEnabled: event.referralsEnabled,
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
          referral: referral ?? waitlistReferral ?? null,
        })
        .onConflictDoNothing({
          target: [tickets.eventId, tickets.email],
        })
        .returning({
          id: tickets.id,
          email: tickets.email,
          type: tickets.type,
          name: tickets.name,
          eventId: tickets.eventId,
        });

      if (!standbyTicket) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_ALREADY_HAS_TICKET },
          { status: 400 },
        );
      }

      if (existingWaitlistEntry) {
        try {
          await db.execute(sql`
            SELECT leave_waitlist(${event_id}::uuid, ${user.email})
          `);
        } catch (waitlistDeleteError) {
          console.error("Standby waitlist cleanup error:", waitlistDeleteError);
        }
      }

      queueReferralRecordUpdate(event_id, user.email);

      await queueTicketEmail(
        buildTicketEmailPayload({
          event,
          ticketId: standbyTicket.id,
          ticketType: "STANDBY",
          userEmail: standbyTicket.email,
          userName: nameForTicket,
        }),
      );

      queueAuditEvent({
        action: "ticket.get",
        actor: user.email,
        eventId: event_id,
        eventName: event.name ?? null,
        targetEmail: user.email,
        metadata: { type: "STANDBY", ticketId: standbyTicket.id },
      });
      queueMailingListAdd(user.email, "ticket");

      return NextResponse.json(
        {
          success: true,
          message: TICKET_MESSAGES.SUCCESS,
          ticketId: standbyTicket.id,
          ticketName: standbyTicket.name ?? nameForTicket ?? null,
          ticketType: standbyTicket?.type || "STANDBY",
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

    const nameForTicket = userName?.trim();
    if (!nameForTicket) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_NAME_REQUIRED },
        { status: 400 },
      );
    }

    // Call stored procedure via raw SQL (atomic ticket creation with FOR UPDATE locking)
    let rpcData: TicketCreationRpcResult | null = null;
    try {
      const result = await db.execute<{
        create_ticket_with_name: TicketCreationRpcResult;
      }>(sql`
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
      if (msg.includes("standby_only")) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_STANDBY_ONLY },
          { status: 400 },
        );
      }
      if (msg.includes("self_referral")) {
        return NextResponse.json(
          { error: "You cannot use your own referral code" },
          { status: 400 },
        );
      }
      if (msg.includes("invalid_referral")) {
        return NextResponse.json(
          { error: "Invalid referral code for this event" },
          { status: 400 },
        );
      }
      if (msg.includes("already")) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_ALREADY_HAS_TICKET },
          { status: 400 },
        );
      }
      if (isUniqueTicketConflict(rpcError)) {
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

    const ticketId = rpcData?.ticket_id ?? null;

    if (!ticketId) {
      console.error("Ticket RPC returned without a ticket id:", rpcData);
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    queueReferralRecordUpdate(event_id, user.email);
    await queueTicketEmail(
      buildTicketEmailPayload({
        event,
        ticketId,
        ticketType: "STANDARD",
        userEmail: user.email,
        userName: nameForTicket,
      }),
    );
    queueAuditEvent({
      action: "ticket.get",
      actor: user.email,
      eventId: event_id,
      eventName: event.name ?? null,
      targetEmail: user.email,
      metadata: { type: "STANDARD", ticketId },
    });
    queueMailingListAdd(user.email, "ticket");

    return NextResponse.json(
      {
        success: true,
        message: TICKET_MESSAGES.SUCCESS,
        ticketId,
        ticketName: nameForTicket,
        ticketType: "STANDARD",
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
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event_id, cancel_token } = body as {
      event_id?: string;
      cancel_token?: string;
    };

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_MISSING_EVENT_ID },
        { status: 400 },
      );
    }

    const sessionUser = await getSessionUser();
    const signedLinkClaims =
      typeof cancel_token === "string" && cancel_token.trim()
        ? await verifyCancellationToken(cancel_token.trim())
        : null;
    const authenticatedEmail =
      signedLinkClaims?.email ?? sessionUser?.email ?? null;
    const authMethod = signedLinkClaims ? "signed_link" : "session";

    if (!authenticatedEmail) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    const rateLimitResponse = await checkRateLimit(
      ticketRatelimit,
      `ticket:${authenticatedEmail}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Check if event is over
    const eventRow = await db.query.events.findFirst({
      where: eq(events.id, event_id),
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
        standbyEnabled: true,
        tagline: true,
        imgVersion: true,
      },
    });

    if (
      isEventOver({
        endTime: eventRow?.endTimeDate,
        startTime: eventRow?.startTimeDate,
      })
    ) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_EVENT_STARTED_OR_ENDED },
        { status: 400 },
      );
    }

    if (!eventRow) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    const ticketToCancel = await db.query.tickets.findFirst({
      where: signedLinkClaims
        ? and(
            eq(tickets.id, signedLinkClaims.ticketId),
            eq(tickets.eventId, event_id),
            eq(tickets.email, authenticatedEmail),
          )
        : and(
            eq(tickets.eventId, event_id),
            eq(tickets.email, authenticatedEmail),
          ),
      columns: { id: true, createdAt: true, name: true, type: true },
    });

    if (signedLinkClaims && !ticketToCancel) {
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_NO_TICKET },
        { status: 400 },
      );
    }

    let rpcData: TicketCancellationRpcResult | null = null;
    try {
      const result = await db.execute<{
        cancel_ticket_and_promote: TicketCancellationRpcResult;
      }>(sql`
        SELECT cancel_ticket_and_promote(${event_id}::uuid, ${authenticatedEmail})
      `);
      rpcData = result[0]?.cancel_ticket_and_promote ?? null;
    } catch (rpcError: unknown) {
      const msg = getErrorMessage(rpcError).toLowerCase();
      if (msg.includes("does not exist") && msg.includes("function")) {
        console.error("Ticket cancellation RPC missing:", rpcError);
        return NextResponse.json(
          {
            error:
              "Ticket cancellation RPC is not installed in the database (cancel_ticket_and_promote).",
          },
          { status: 500 },
        );
      }
      if (msg.includes("already_scanned")) {
        return NextResponse.json(
          { error: "Cannot cancel a ticket that has already been scanned." },
          { status: 400 },
        );
      }
      if (msg.includes("event_not_found")) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_EVENT_NOT_FOUND },
          { status: 404 },
        );
      }
      if (msg.includes("not_found")) {
        return NextResponse.json(
          { error: TICKET_MESSAGES.ERROR_NO_TICKET },
          { status: 400 },
        );
      }

      console.error("Ticket cancellation RPC error:", rpcError);
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    const cancelledTicketId = rpcData?.cancelled_ticket_id ?? null;
    const gotTicketAt = ticketToCancel?.createdAt?.toISOString() ?? null;
    const heldFor = formatHeldFor(ticketToCancel?.createdAt);
    if (!cancelledTicketId) {
      console.error(
        "Ticket cancellation RPC returned without a cancelled ticket id:",
        rpcData,
      );
      return NextResponse.json(
        { error: TICKET_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    let cancellationEmailQueued = false;
    if (eventRow && ticketToCancel) {
      await queueCancellationEmail({
        email: authenticatedEmail,
        name: ticketToCancel.name ?? null,
        eventName: eventRow.name || "Event",
        ticketType: ticketToCancel.type || "STANDARD",
        eventStartTime: eventRow.startTimeDate?.toISOString() || null,
        eventVenue: eventRow.venue || null,
        eventVenueLink: eventRow.venueLink || null,
        eventRoute: eventRow.route || null,
        eventId: eventRow.id,
        imgVersion: eventRow.imgVersion ?? null,
        eventTagline: eventRow.tagline || null,
      });
      cancellationEmailQueued = true;
    }

    queueAuditEvent({
      action: "ticket.cancel",
      actor: authenticatedEmail,
      eventId: event_id,
      eventName: eventRow?.name ?? null,
      targetEmail: authenticatedEmail,
      metadata: {
        authMethod,
        ...(gotTicketAt ? { gotTicketAt } : {}),
        ...(heldFor ? { heldFor } : {}),
        ticketId: cancelledTicketId,
        ...(cancellationEmailQueued ? { cancellationEmailSent: true } : {}),
      },
    });

    if (rpcData?.promoted_ticket_id && rpcData.promoted_email && eventRow) {
      queueAuditEvent({
        action: "waitlist.pull",
        actor: authenticatedEmail,
        eventId: event_id,
        eventName: eventRow.name ?? null,
        targetEmail: rpcData.promoted_email,
        metadata: {
          authMethod,
          trigger: "ticket.cancel",
          ticketId: rpcData.promoted_ticket_id,
          ticketType: rpcData.promoted_ticket_type || "STANDARD",
          cancelledTicketId,
        },
      });

      queueReferralRecordUpdate(event_id, rpcData.promoted_email);
      await queueTicketEmail(
        buildTicketEmailPayload({
          event: eventRow,
          ticketId: rpcData.promoted_ticket_id,
          ticketType: rpcData.promoted_ticket_type || "STANDARD",
          userEmail: rpcData.promoted_email,
          userName: rpcData.promoted_name ?? null,
        }),
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
