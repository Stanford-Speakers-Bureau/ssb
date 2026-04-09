import { after, NextResponse } from "next/server";
import { getRoleNamesForEmail, getSessionUser } from "@/app/lib/auth";
import { db, eq, and, sql, count, events, waitlist } from "@ssb/db";
import { checkRateLimit, ticketRatelimit } from "@/app/lib/ratelimit";
import { logAuditEvent } from "@/app/lib/audit";
import { type WaitlistEmailData } from "@/app/lib/email";
import {
  createWaitlistEmailJob,
  enqueueEmailJob,
  processEmailJob,
} from "@/app/lib/email-jobs";
import { validateReferralInput } from "@/app/lib/referrals";
import {
  getRoleIneligiblePayload,
  isTicketingEligible,
  resolveTicketingRoles,
} from "@/app/lib/ticketingRoles";

const WAITLIST_MESSAGES = {
  SUCCESS: "You've been added to the waitlist!",
  DELETED: "Successfully left the waitlist",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in.",
  ERROR_EVENT_NOT_FOUND: "Event not found",
  ERROR_NOT_SOLD_OUT: "Event is not sold out. Please get a ticket instead.",
  ERROR_ALREADY_HAS_TICKET: "You already have a ticket for this event.",
  ERROR_ALREADY_ON_WAITLIST: "You're already on the waitlist for this event.",
  ERROR_NOT_ON_WAITLIST: "You're not on the waitlist for this event.",
  ERROR_WAITLIST_CLOSED:
    "Waitlist is now closed. Please visit the venue for the standby line.",
  ERROR_FEE_WAIVER_INELIGIBLE:
    "Unfortunately, you are ineligible for online ticketing as your student activity fee for Speakers Bureau has been waived. We encourage you to show up to the venue early to join the standby line instead. Please contact ASSU for further details.",
} as const;

const FEE_WAIVER_ROLE = "fee_waiver";
const FEE_WAIVER_INELIGIBLE_CODE = "fee_waiver_ineligible";
const ASSU_URL = "https://assu.stanford.edu";
const ASSU_FAQ_URL = "https://www.assu.stanford.edu/m/FAQ#question-85";

function getFeeWaiverIneligiblePayload() {
  return {
    error: WAITLIST_MESSAGES.ERROR_FEE_WAIVER_INELIGIBLE,
    code: FEE_WAIVER_INELIGIBLE_CODE,
    assuUrl: ASSU_URL,
    faqUrl: ASSU_FAQ_URL,
  };
}

type JoinWaitlistRpcResult = {
  position: number;
  total: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function scheduleAfterResponse(
  label: string,
  task: () => Promise<void>,
) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`${label} error:`, error);
    }
  });
}

async function queueWaitlistEmail(data: WaitlistEmailData) {
  const queued = await enqueueEmailJob(createWaitlistEmailJob(data));
  if (queued) {
    return;
  }

  scheduleAfterResponse("Waitlist email", async () => {
    await processEmailJob(createWaitlistEmailJob(data));
  });
}

function queueAuditEvent(params: Parameters<typeof logAuditEvent>[0]) {
  scheduleAfterResponse("Audit log", async () => {
    await logAuditEvent(params);
  });
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    // Rate limit by user email
    const rateLimitResponse = await checkRateLimit(
      ticketRatelimit,
      `waitlist:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event_id, referral: referralFromBody, name: nameFromBody } = body as {
      event_id?: string;
      referral?: string;
      name?: string;
    };

    if (!event_id) {
      return NextResponse.json(
        { error: "Missing required field: event_id" },
        { status: 400 },
      );
    }

    // Get event details
    const event = await db.query.events.findFirst({
      where: eq(events.id, event_id),
      columns: {
        id: true,
        name: true,
        doorsOpen: true,
        startTimeDate: true,
        venue: true,
        venueLink: true,
        desc: true,
        standbyEnabled: true,
        tagline: true,
        imgVersion: true,
        referralsEnabled: true,
        ticketingRoles: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    const userRoles = await getRoleNamesForEmail(user.email);
    const userAffiliations = [
      ...user.eduPersonAffiliation,
      ...user.eduPersonScopedAffiliation,
    ];

    // Prefer the fee-waiver-specific response here so users still get the ASSU links.
    if (userRoles.includes(FEE_WAIVER_ROLE)) {
      queueAuditEvent({
        action: "ticket.ineligible",
        actor: user.email,
        eventId: event_id,
        eventName: event.name ?? null,
        targetEmail: user.email,
        metadata: {
          attemptedType: "WAITLIST",
          reason: FEE_WAIVER_ROLE,
          assuUrl: ASSU_URL,
          faqUrl: ASSU_FAQ_URL,
        },
      });

      return NextResponse.json(
        getFeeWaiverIneligiblePayload(),
        { status: 403 },
      );
    }

    if (!isTicketingEligible(userAffiliations, event.ticketingRoles)) {
      const allowedRoles = resolveTicketingRoles(event.ticketingRoles);

      queueAuditEvent({
        action: "ticket.ineligible",
        actor: user.email,
        eventId: event_id,
        eventName: event.name ?? null,
        targetEmail: user.email,
        metadata: {
          attemptedType: "WAITLIST",
          reason: "ticketing_roles",
          allowedRoles,
          userAffiliations,
        },
      });

      return NextResponse.json(
        getRoleIneligiblePayload(allowedRoles),
        { status: 403 },
      );
    }

    // Derive name from body override or OAuth metadata
    const waitlistName =
      nameFromBody?.trim() ||
      user.displayName ||
      null;

    if (!waitlistName) {
      return NextResponse.json(
        { error: "Name is required to join the waitlist" },
        { status: 400 },
      );
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

    // Use stored procedure to atomically join waitlist (prevents position collisions)
    let rpcData: JoinWaitlistRpcResult | null = null;
    try {
      const result = await db.execute<{ join_waitlist_with_name: JoinWaitlistRpcResult }>(sql`
        SELECT join_waitlist_with_name(
          ${event_id}::uuid,
          ${referral || null},
          ${waitlistName},
          ${user.email}
        )
      `);
      rpcData = result[0]?.join_waitlist_with_name;
    } catch (rpcError: unknown) {
      const msg = getErrorMessage(rpcError).toLowerCase();
      if (msg.includes("does not exist") && msg.includes("function")) {
        console.error("Waitlist RPC missing:", rpcError);
        return NextResponse.json(
          {
            error:
              "Waitlist RPC is not installed in the database (join_waitlist_with_name).",
          },
          { status: 500 },
        );
      }
      if (msg.includes("already_has_ticket")) {
        return NextResponse.json(
          { error: WAITLIST_MESSAGES.ERROR_ALREADY_HAS_TICKET },
          { status: 400 },
        );
      }
      if (msg.includes("already")) {
        return NextResponse.json(
          { error: WAITLIST_MESSAGES.ERROR_ALREADY_ON_WAITLIST },
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
      if (msg.includes("not_sold_out")) {
        return NextResponse.json(
          { error: WAITLIST_MESSAGES.ERROR_NOT_SOLD_OUT },
          { status: 400 },
        );
      }
      if (msg.includes("waitlist_closed")) {
        return NextResponse.json(
          { error: WAITLIST_MESSAGES.ERROR_WAITLIST_CLOSED },
          { status: 400 },
        );
      }
      if (msg.includes("event_not_found")) {
        return NextResponse.json(
          { error: WAITLIST_MESSAGES.ERROR_EVENT_NOT_FOUND },
          { status: 404 },
        );
      }

      console.error("Waitlist RPC error:", rpcError);
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    const waitlistPosition = rpcData?.position ?? null;

    if (!waitlistPosition) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    await queueWaitlistEmail({
      email: user.email,
      eventName: event.name || "Event",
      position: waitlistPosition,
      eventStartTime: event.startTimeDate?.toISOString() ?? null,
      eventVenue: event.venue,
      eventVenueLink: event.venueLink,
      eventDescription: event.desc,
      eventId: event.id,
      imgVersion: event.imgVersion,
      eventTagline: event.tagline,
    });

    return NextResponse.json(
      {
        success: true,
        message: WAITLIST_MESSAGES.SUCCESS,
        position: waitlistPosition,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Waitlist join error:", error);
    return NextResponse.json(
      { error: WAITLIST_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event_id } = body as { event_id?: string };

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: "Missing required field: event_id" },
        { status: 400 },
      );
    }

    // Use stored procedure to atomically leave waitlist (prevents race conditions during recalculation)
    try {
      await db.execute(sql`
        SELECT leave_waitlist(${event_id}::uuid, ${user.email})
      `);
    } catch (rpcError: unknown) {
      const msg = getErrorMessage(rpcError).toLowerCase();
      if (msg.includes("does not exist") && msg.includes("function")) {
        console.error("Waitlist RPC missing:", rpcError);
        return NextResponse.json(
          {
            error:
              "Waitlist RPC is not installed in the database (leave_waitlist).",
          },
          { status: 500 },
        );
      }
      if (msg.includes("not_found")) {
        return NextResponse.json(
          { error: WAITLIST_MESSAGES.ERROR_NOT_ON_WAITLIST },
          { status: 400 },
        );
      }

      console.error("Waitlist RPC error:", rpcError);
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: WAITLIST_MESSAGES.DELETED,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Waitlist delete error:", error);
    return NextResponse.json(
      { error: WAITLIST_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: WAITLIST_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    if (eventId) {
      // Get status for specific event
      const entry = await db.query.waitlist.findFirst({
        where: and(eq(waitlist.eventId, eventId), eq(waitlist.email, user.email)),
        columns: { position: true },
      });

      const [totalResult] = await db.select({ count: count() })
        .from(waitlist)
        .where(eq(waitlist.eventId, eventId));

      return NextResponse.json(
        {
          isOnWaitlist: !!entry,
          position: entry?.position ?? null,
          total: totalResult?.count ?? 0,
        },
        { status: 200 },
      );
    } else {
      // Get all waitlist entries for user
      const entries = await db.query.waitlist.findMany({
        where: eq(waitlist.email, user.email),
        columns: {
          id: true,
          position: true,
          createdAt: true,
          referral: true,
          eventId: true,
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
        orderBy: (waitlist, { desc }) => [desc(waitlist.createdAt)],
      });

      // Transform to match expected API shape (snake_case)
      const serializedEntries = entries.map((e) => ({
        id: e.id,
        position: e.position,
        created_at: e.createdAt.toISOString(),
        referral: e.referral,
        event_id: e.eventId,
        events: e.event
          ? {
            id: e.event.id,
            name: e.event.name,
            route: e.event.route,
            start_time_date: e.event.startTimeDate?.toISOString() ?? null,
            venue: e.event.venue,
          }
          : null,
      }));

      return NextResponse.json(
        {
          waitlists: serializedEntries,
        },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error("Waitlist status check error:", error);
    return NextResponse.json(
      { error: WAITLIST_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}
