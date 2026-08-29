import { NextResponse } from "next/server";
import {
  getAvailablePublicTickets,
} from "@/app/lib/supabase";
import { getHighestAffiliation } from "@/app/lib/affiliation";
import {
  getFeeWaiverEmailSetForEmails,
  hasFeeWaiverForEmail,
  normalizeEmail,
} from "@/app/lib/auth";
import {
  requireAnyPermission,
  requirePermission,
} from "@/app/lib/permissions";
import {
  sendCancellationEmail,
  sendDayOfReminderEmail,
  sendEarlyReminderEmail,
  sendTicketEmail,
  sendStandbyLineEmail,
} from "@/app/lib/email";
import {
  PACIFIC_TIMEZONE,
  REMINDER_EMAIL_BATCH_SIZE,
  REMINDER_EMAIL_MIN_BATCH_DURATION_MS,
} from "@/app/lib/constants";
import {
  pullFromWaitlist,
  removeWaitlistEntryForEmail,
} from "@/app/lib/waitlist";
import {
  db,
  eq,
  and,
  or,
  ilike,
  inArray,
  count as dbCount,
  sql,
  tickets,
  events,
  userProfiles,
  walletVoidedPasses,
} from "@ssb/db";
import { isValidUUID } from "@/app/lib/validation";
import { logAuditEvent } from "@/app/lib/audit";
import { pushWalletUpdate } from "@/app/lib/wallet-push";
import { recordMailingListMember } from "@/app/lib/mailing-list";
import {
  logSendFailures,
  partitionBySuppression,
} from "@/app/lib/email-suppression";

type TicketAffiliationKey =
  | "student"
  | "faculty"
  | "affiliate"
  | "staff"
  | "member"
  | "unknown";

const AFFILIATION_PRIORITY: Exclude<TicketAffiliationKey, "unknown">[] = [
  "student",
  "faculty",
  "affiliate",
  "staff",
  "member",
];

const TICKET_AFFILIATION_FILTERS = new Set<TicketAffiliationKey>([
  "student",
  "faculty",
  "affiliate",
  "staff",
  "member",
  "unknown",
]);

function createEmptyAffiliationCounts(): Record<TicketAffiliationKey, number> {
  return {
    student: 0,
    faculty: 0,
    affiliate: 0,
    staff: 0,
    member: 0,
    unknown: 0,
  };
}

async function getTicketAffiliationMap(
  emails: string[],
): Promise<Map<string, TicketAffiliationKey>> {
  const normalizedEmails = [
    ...new Set(emails.map((email) => normalizeEmail(email)).filter(Boolean)),
  ];

  if (normalizedEmails.length === 0) {
    return new Map();
  }

  const profileRows = await db.query.userProfiles.findMany({
    where: inArray(userProfiles.email, normalizedEmails),
    columns: {
      email: true,
      eduPersonAffiliation: true,
      eduPersonScopedAffiliation: true,
    },
  });

  const affiliationByEmail = new Map<string, TicketAffiliationKey>();

  for (const profile of profileRows) {
    affiliationByEmail.set(
      normalizeEmail(profile.email),
      getHighestAffiliation(
        [
          ...profile.eduPersonAffiliation,
          ...profile.eduPersonScopedAffiliation,
        ],
        AFFILIATION_PRIORITY,
      ) ?? "unknown",
    );
  }

  return affiliationByEmail;
}

function getTicketAffiliationForEmail(
  email: string,
  affiliationByEmail: Map<string, TicketAffiliationKey>,
): TicketAffiliationKey {
  return affiliationByEmail.get(normalizeEmail(email)) ?? "unknown";
}

function countTicketsByAffiliation<T extends { email: string }>(
  rows: T[],
  affiliationByEmail: Map<string, TicketAffiliationKey>,
): Record<TicketAffiliationKey, number> {
  const counts = createEmptyAffiliationCounts();

  for (const row of rows) {
    counts[getTicketAffiliationForEmail(row.email, affiliationByEmail)]++;
  }

  return counts;
}

/** Helper to serialize a ticket (with optional event relation) to snake_case for API response */
function serializeTicket(ticket: {
  id: string;
  email: string;
  name: string | null;
  title: string | null;
  type: string;
  createdAt: Date;
  scanned: boolean;
  scanTime: Date | null;
  referral: string | null;
  eventId: string | null;
  event?: {
    id: string;
    name: string | null;
    route: string | null;
    startTimeDate: Date | null;
    endTimeDate?: Date | null;
    venue?: string | null;
    venueLink?: string | null;
    desc?: string | null;
    doorsOpen?: Date | null;
  } | null;
}, hasFeeWaiver = false) {
  return {
    id: ticket.id,
    email: ticket.email,
    name: ticket.name,
    title: ticket.title,
    type: ticket.type,
    created_at: ticket.createdAt.toISOString(),
    scanned: ticket.scanned,
    scan_time: ticket.scanTime?.toISOString() ?? null,
    referral: ticket.referral,
    has_fee_waiver: hasFeeWaiver,
    event_id: ticket.eventId,
    events: ticket.event
      ? {
        id: ticket.event.id,
        name: ticket.event.name,
        route: ticket.event.route,
        start_time_date: ticket.event.startTimeDate?.toISOString() ?? null,
        ...(ticket.event.endTimeDate !== undefined ? { end_time_date: ticket.event.endTimeDate?.toISOString() ?? null } : {}),
        ...(ticket.event.venue !== undefined ? { venue: ticket.event.venue } : {}),
        ...(ticket.event.venueLink !== undefined ? { venue_link: ticket.event.venueLink } : {}),
        ...(ticket.event.desc !== undefined ? { desc: ticket.event.desc } : {}),
        ...(ticket.event.doorsOpen !== undefined ? { doors_open: ticket.event.doorsOpen?.toISOString() ?? null } : {}),
      }
      : null,
  };
}

function buildFeeWaiverTicketCondition() {
  return sql<boolean>`exists (
    select 1
    from roles role_row
    where lower(trim(role_row.email)) = lower(trim(${tickets.email}))
      and role_row.roles ilike '%fee_waiver%'
      and exists (
        select 1
        from unnest(string_to_array(coalesce(role_row.roles, ''), ',')) as role_name(role_value)
        where lower(trim(role_value)) = 'fee_waiver'
      )
  )`;
}

async function serializeTicketWithFeeWaiver(ticket: {
  id: string;
  email: string;
  name: string | null;
  title: string | null;
  type: string;
  createdAt: Date;
  scanned: boolean;
  scanTime: Date | null;
  referral: string | null;
  eventId: string | null;
  event?: {
    id: string;
    name: string | null;
    route: string | null;
    startTimeDate: Date | null;
    endTimeDate?: Date | null;
    venue?: string | null;
    venueLink?: string | null;
    desc?: string | null;
    doorsOpen?: Date | null;
  } | null;
}) {
  return serializeTicket(ticket, await hasFeeWaiverForEmail(ticket.email));
}

function getErrorMessage(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join(" ");
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

/** Standard ticket columns */
const TICKET_COLUMNS = {
  id: true, email: true, name: true, title: true, type: true, createdAt: true,
  scanned: true, scanTime: true, referral: true, eventId: true,
} as const;

/** Standard event relation (basic fields) */
const TICKET_WITH_EVENT = {
  event: { columns: { id: true, name: true, route: true, startTimeDate: true, endTimeDate: true } },
} as const;

/** Extended event relation (includes venue/desc/doorsOpen for emails) */
const TICKET_WITH_EVENT_DETAILS = {
  event: { columns: { id: true, name: true, route: true, startTimeDate: true, endTimeDate: true, venue: true, venueLink: true, desc: true, doorsOpen: true, tagline: true, imgVersion: true } },
} as const;

function formatDoorsOpenTime(doorsOpen: Date | null | undefined): string | undefined {
  if (!doorsOpen) return undefined;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PACIFIC_TIMEZONE,
  }).format(new Date(doorsOpen));
}

/** Extended event relation with doors_open for reminders */
const TICKET_WITH_DOORS_OPEN = {
  event: { columns: { id: true, name: true, route: true, startTimeDate: true, endTimeDate: true, venue: true, venueLink: true, desc: true, doorsOpen: true, tagline: true, imgVersion: true } },
} as const;

type ReminderRecipient = {
  id: string;
  email: string;
  name: string | null;
  type: string | null;
};

async function sendReminderBatch(options: {
  recipients: ReminderRecipient[];
  batchSize: number;
  minBatchDurationMs: number;
  sendEmail: (recipient: ReminderRecipient) => Promise<void>;
  logPrefix: string;
}) {
  const {
    recipients,
    batchSize,
    minBatchDurationMs,
    sendEmail,
    logPrefix,
  } = options;

  const results: PromiseSettledResult<{
    success: boolean;
    email: string;
    error?: unknown;
  }>[] = [];

  for (let index = 0; index < recipients.length; index += batchSize) {
    const batchStartTime = Date.now();
    const batch = recipients.slice(index, index + batchSize);
    const batchPromises = batch.map((recipient) =>
      sendEmail(recipient).then(
        () => ({ success: true, email: recipient.email }),
        (error) => ({ success: false, email: recipient.email, error }),
      ),
    );
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);

    const batchDuration = Date.now() - batchStartTime;
    if (
      minBatchDurationMs > 0 &&
      batchDuration < minBatchDurationMs &&
      index + batchSize < recipients.length
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, minBatchDurationMs - batchDuration),
      );
    }
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const sentEmails: string[] = [];
  const failures: Array<{ email: string; error: unknown }> = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      const emailResult = result.value;
      if (emailResult.success) {
        sent++;
        sentEmails.push(emailResult.email);
      } else {
        failed++;
        const errorMessage = emailResult.error instanceof Error
          ? emailResult.error.message
          : "Unknown error";
        errors.push(`${emailResult.email}: ${errorMessage}`);
        failures.push({
          email: emailResult.email,
          error: emailResult.error,
        });
        console.error(
          `${logPrefix} ${emailResult.email}:`,
          emailResult.error ?? "Unknown error",
        );
      }
    } else {
      failed++;
      errors.push(`Promise rejected: ${result.reason}`);
      console.error(`${logPrefix} promise rejected:`, result.reason);
    }
  }

  return { sent, failed, errors, failures, sentEmails };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    const auth = await requirePermission("tickets.view", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const search = searchParams.get("search");
    const type = searchParams.get("type");
    const scanned = searchParams.get("scanned");
    const feeWaiver = searchParams.get("feeWaiver");
    const rawAffiliation = searchParams.get("affiliation");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const affiliation =
      rawAffiliation && TICKET_AFFILIATION_FILTERS.has(rawAffiliation as TicketAffiliationKey)
        ? (rawAffiliation as TicketAffiliationKey)
        : null;

    if (rawAffiliation && !affiliation) {
      return NextResponse.json(
        { error: "Invalid affiliation filter" },
        { status: 400 },
      );
    }

    const feeWaiverCondition = buildFeeWaiverTicketCondition();
    const nonAffiliationWhereClause = and(
      eventId ? eq(tickets.eventId, eventId) : undefined,
      search ? or(ilike(tickets.email, `%${search}%`), ilike(tickets.name, `%${search}%`)) : undefined,
      type ? eq(tickets.type, type) : undefined,
      scanned !== null && scanned !== undefined && scanned !== ""
        ? eq(tickets.scanned, scanned === "true")
        : undefined,
      feeWaiver === "true" ? feeWaiverCondition : undefined,
    );
    const whereClause = nonAffiliationWhereClause;

    const baseWhereClause = eventId ? eq(tickets.eventId, eventId) : undefined;

    const [
      [totalResult],
      [scannedResult],
      [unscannedResult],
      [filteredResult],
      [standardResult],
      [vipResult],
      [externalResult],
      [waitlistResult],
      [feeWaiverResult],
    ] = await Promise.all([
      db.select({ count: dbCount() }).from(tickets).where(baseWhereClause),
      db.select({ count: dbCount() }).from(tickets).where(baseWhereClause ? and(baseWhereClause, eq(tickets.scanned, true)) : eq(tickets.scanned, true)),
      db.select({ count: dbCount() }).from(tickets).where(baseWhereClause ? and(baseWhereClause, eq(tickets.scanned, false)) : eq(tickets.scanned, false)),
      db.select({ count: dbCount() }).from(tickets).where(whereClause),
      db.select({ count: dbCount() }).from(tickets).where(baseWhereClause ? and(baseWhereClause, eq(tickets.type, "STANDARD")) : eq(tickets.type, "STANDARD")),
      db.select({ count: dbCount() }).from(tickets).where(baseWhereClause ? and(baseWhereClause, eq(tickets.type, "VIP")) : eq(tickets.type, "VIP")),
      db.select({ count: dbCount() }).from(tickets).where(baseWhereClause ? and(baseWhereClause, eq(tickets.type, "EXTERNAL")) : eq(tickets.type, "EXTERNAL")),
      db.select({ count: dbCount() }).from(tickets).where(baseWhereClause ? and(baseWhereClause, eq(tickets.type, "STANDBY")) : eq(tickets.type, "STANDBY")),
      db.select({ count: dbCount() })
        .from(tickets)
        .where(baseWhereClause ? and(baseWhereClause, feeWaiverCondition) : feeWaiverCondition),
    ]);
    let affiliationCounts = createEmptyAffiliationCounts();
    let filteredCount = filteredResult?.count ?? 0;
    let ticketResults: Array<Parameters<typeof serializeTicket>[0]> = [];

    if (affiliation) {
      const affiliationSourceRows = eventId
        ? await db.query.tickets.findMany({
            where: whereClause,
            columns: TICKET_COLUMNS,
            with: TICKET_WITH_EVENT,
            orderBy: (t, { desc }) => [desc(t.createdAt)],
          })
        : [];
      const affiliationByEmail = await getTicketAffiliationMap(
        affiliationSourceRows.map((ticket) => ticket.email),
      );

      affiliationCounts = countTicketsByAffiliation(
        affiliationSourceRows,
        affiliationByEmail,
      );

      const filteredAffiliationRows = affiliationSourceRows.filter(
        (ticket) =>
          getTicketAffiliationForEmail(ticket.email, affiliationByEmail) === affiliation,
      );

      ticketResults = filteredAffiliationRows.slice(offset, offset + limit);
      filteredCount = filteredAffiliationRows.length;
    } else {
      const [paginatedTicketResults, affiliationSourceRows] = await Promise.all([
        db.query.tickets.findMany({
          where: whereClause,
          columns: TICKET_COLUMNS,
          with: TICKET_WITH_EVENT,
          orderBy: (t, { desc }) => [desc(t.createdAt)],
          offset,
          limit,
        }),
        eventId
          ? db.query.tickets.findMany({
              where: whereClause,
              columns: {
                email: true,
              },
            })
          : Promise.resolve([]),
      ]);

      const affiliationByEmail = await getTicketAffiliationMap(
        affiliationSourceRows.map((ticket) => ticket.email),
      );

      affiliationCounts = countTicketsByAffiliation(
        affiliationSourceRows,
        affiliationByEmail,
      );
      ticketResults = paginatedTicketResults;
    }

    const feeWaiverEmails = await getFeeWaiverEmailSetForEmails(
      ticketResults.map((ticket) => ticket.email),
    );

    return NextResponse.json({
      tickets: ticketResults.map((ticket) =>
        serializeTicket(ticket, feeWaiverEmails.has(normalizeEmail(ticket.email)))
      ),
      total: totalResult?.count ?? 0,
      scannedCount: scannedResult?.count ?? 0,
      unscannedCount: unscannedResult?.count ?? 0,
      feeWaiverCount: feeWaiverResult?.count ?? 0,
      filteredCount,
      standardCount: standardResult?.count ?? 0,
      vipCount: vipResult?.count ?? 0,
      externalCount: externalResult?.count ?? 0,
      standbyCount: waitlistResult?.count ?? 0,
      affiliationCounts,
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
    const body = await req.json();
    const { id, sendCancellationEmail: shouldSendCancellationEmail } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 },
      );
    }

    // Fetch the ticket before deleting to get event_id, type, and event details for cancellation email
    const ticketToDelete = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
      columns: { email: true, eventId: true, type: true, name: true, createdAt: true },
      with: {
        event: {
          columns: {
            id: true,
            name: true,
            route: true,
            startTimeDate: true,
            venue: true,
            venueLink: true,
            tagline: true,
            imgVersion: true,
          },
        },
      },
    });

    if (!ticketToDelete) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const auth = await requirePermission(
      "tickets.delete",
      ticketToDelete.eventId,
    );
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    if (!ticketToDelete.eventId) {
      await db.delete(tickets).where(eq(tickets.id, id));
      const gotTicketAt = ticketToDelete.createdAt?.toISOString() ?? null;
      const heldFor = formatHeldFor(ticketToDelete.createdAt);

      await logAuditEvent({
        action: "ticket.delete",
        actor: auth.email!,
        eventId: null,
        eventName: null,
        targetEmail: ticketToDelete.email,
        metadata: {
          ...(gotTicketAt ? { gotTicketAt } : {}),
          ...(heldFor ? { heldFor } : {}),
          ticketId: id,
          type: ticketToDelete.type,
        },
      });

      return NextResponse.json({ success: true });
    }

    let rpcData: TicketCancellationRpcResult | null = null;
    try {
      const result = await db.execute<{
        cancel_ticket_and_promote: TicketCancellationRpcResult;
      }>(sql`
        SELECT cancel_ticket_and_promote(
          ${ticketToDelete.eventId}::uuid,
          ${ticketToDelete.email}
        )
      `);
      rpcData = result[0]?.cancel_ticket_and_promote ?? null;
    } catch (rpcError: unknown) {
      const message = getErrorMessage(rpcError).toLowerCase();
      if (message.includes("does not exist") && message.includes("function")) {
        console.error("Ticket cancellation RPC missing:", rpcError);
        return NextResponse.json(
          {
            error:
              "Ticket cancellation RPC is not installed in the database (cancel_ticket_and_promote).",
          },
          { status: 500 },
        );
      }
      if (message.includes("already_scanned")) {
        return NextResponse.json(
          { error: "Cannot cancel a ticket that has already been scanned." },
          { status: 400 },
        );
      }
      if (message.includes("event_not_found")) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      if (message.includes("not_found")) {
        return NextResponse.json(
          { error: "No ticket found for this event" },
          { status: 400 },
        );
      }

      console.error("Ticket cancellation RPC error:", rpcError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const cancelledTicketId = rpcData?.cancelled_ticket_id ?? null;
    const gotTicketAt = ticketToDelete.createdAt?.toISOString() ?? null;
    const heldFor = formatHeldFor(ticketToDelete.createdAt);
    if (!cancelledTicketId) {
      console.error(
        "Ticket cancellation RPC returned without a cancelled ticket id:",
        rpcData,
      );
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    await logAuditEvent({
      action: "ticket.delete",
      actor: auth.email!,
      eventId: ticketToDelete.eventId,
      eventName: ticketToDelete.event?.name ?? null,
      targetEmail: ticketToDelete.email,
      metadata: {
        ...(gotTicketAt ? { gotTicketAt } : {}),
        ...(heldFor ? { heldFor } : {}),
        ticketId: cancelledTicketId,
        type: ticketToDelete.type,
        ...(shouldSendCancellationEmail ? { cancellationEmailSent: true } : {}),
      },
    });

    // Tombstone the cancelled pass so any installed wallet passes flip to a
    // voided "CANCELLED" state, then push. The ticket row is gone, but the
    // event still exists, so the voided pass renders from it. Non-fatal.
    if (ticketToDelete.eventId) {
      try {
        await db
          .insert(walletVoidedPasses)
          .values({
            serialNumber: id,
            email: ticketToDelete.email,
            name: ticketToDelete.name ?? null,
            ticketType: ticketToDelete.type,
            eventId: ticketToDelete.eventId,
          })
          .onConflictDoNothing();
        await pushWalletUpdate([id], {
          actor: auth.email ?? undefined,
          reason: "ticket.cancel",
          eventId: ticketToDelete.eventId,
        });
      } catch (voidError) {
        console.error("Wallet voided-pass push failed (non-fatal):", voidError);
      }
    }

    if (shouldSendCancellationEmail && ticketToDelete.eventId && ticketToDelete.event) {
      try {
        await sendCancellationEmail({
          email: ticketToDelete.email,
          name: ticketToDelete.name ?? null,
          eventName: ticketToDelete.event.name || "Event",
          ticketType: ticketToDelete.type || "STANDARD",
          eventStartTime: ticketToDelete.event.startTimeDate?.toISOString() || null,
          eventVenue: ticketToDelete.event.venue || null,
          eventVenueLink: ticketToDelete.event.venueLink || null,
          eventRoute: ticketToDelete.event.route || null,
          eventId: ticketToDelete.event.id,
          imgVersion: ticketToDelete.event.imgVersion ?? null,
          eventTagline: ticketToDelete.event.tagline || null,
        });
      } catch (emailError) {
        console.error("Cancellation email error (non-fatal):", emailError);
      }
    }

    if (rpcData?.promoted_ticket_id && rpcData.promoted_email) {
      const promotedTicket = await db.query.tickets.findFirst({
        where: eq(tickets.id, rpcData.promoted_ticket_id),
        columns: TICKET_COLUMNS,
        with: TICKET_WITH_EVENT_DETAILS,
      });

      await logAuditEvent({
        action: "waitlist.pull",
        actor: auth.email!,
        eventId: ticketToDelete.eventId,
        eventName: ticketToDelete.event?.name ?? null,
        targetEmail: rpcData.promoted_email,
        metadata: {
          trigger: "ticket.cancel",
          ticketId: rpcData.promoted_ticket_id,
          ticketType:
            rpcData.promoted_ticket_type
            || promotedTicket?.type
            || "STANDARD",
          cancelledTicketId,
        },
      });

      if (promotedTicket) {
        try {
          await sendTicketEmail({
            email: promotedTicket.email,
            name: promotedTicket.name || rpcData.promoted_name || null,
            eventName: promotedTicket.event?.name || "Event",
            ticketType:
              rpcData.promoted_ticket_type
              || promotedTicket.type
              || "STANDARD",
            eventStartTime: promotedTicket.event?.startTimeDate?.toISOString() || null,
            eventEndTime: promotedTicket.event?.endTimeDate?.toISOString() || null,
            eventRoute: promotedTicket.event?.route || null,
            ticketId: promotedTicket.id,
            eventVenue: promotedTicket.event?.venue || null,
            eventVenueLink: promotedTicket.event?.venueLink || null,
            eventDescription: promotedTicket.event?.desc || null,
            doorsOpenTime: promotedTicket.event?.doorsOpen?.toISOString() || null,
            eventId: promotedTicket.event?.id || null,
            imgVersion: promotedTicket.event?.imgVersion ?? null,
            eventTagline: promotedTicket.event?.tagline || null,
          });
        } catch (emailError) {
          console.error(
            "Email sending error for promoted waitlist ticket (non-fatal):",
            emailError,
          );
        }
      }
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

/** Helper to sync event scanned counts */
async function syncEventScannedCounts() {
  const [allEvents, scannedCounts] = await Promise.all([
    db.query.events.findMany({ columns: { id: true, scanned: true } }),
    db.select({ eventId: tickets.eventId, count: dbCount() })
      .from(tickets).where(eq(tickets.scanned, true)).groupBy(tickets.eventId),
  ]);
  const countMap = new Map(scannedCounts.map((r) => [r.eventId, r.count]));
  for (const event of allEvents) {
    const actual = countMap.get(event.id) ?? 0;
    if (event.scanned !== actual) {
      await db.update(events).set({ scanned: actual }).where(eq(events.id, event.id));
    }
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, action, type, scanned, promo, name, title, ticketIds, auditBatchId } = body;

    // Resolve the event this request touches so we can scope the permission
    // check: batch reminders carry eventId on the query string, single-ticket
    // actions inherit it from the ticket row.
    const batchReminderActions = ["sendDayOfReminders", "sendEarlyReminders"];
    let scopeEventId: string | null = null;
    if (batchReminderActions.includes(action)) {
      scopeEventId = new URL(req.url).searchParams.get("eventId");
    } else if (id && typeof id === "string") {
      const scopeTicket = await db.query.tickets.findFirst({
        where: eq(tickets.id, id),
        columns: { eventId: true },
      });
      scopeEventId = scopeTicket?.eventId ?? null;
    }

    // Check-in / unscan map to the scan capability (an editor may also do it);
    // everything else is an edit.
    const isScanAction =
      action === "updateScanned" ||
      action === "unscan" ||
      typeof scanned === "boolean";
    const auth = isScanAction
      ? await requireAnyPermission(["tickets.scan", "tickets.edit"], scopeEventId)
      : await requirePermission("tickets.edit", scopeEventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const normalizedAuditBatchId =
      typeof auditBatchId === "string" && auditBatchId.trim().length > 0
        ? auditBatchId.trim()
        : null;

    // Batch reminder actions don't require a ticket ID - they use eventId from query params
    const batchActions = ["sendDayOfReminders", "sendEarlyReminders"];
    if (!batchActions.includes(action) && (!id || typeof id !== "string")) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 },
      );
    }

    // Handle different actions
    if (action === "updateName") {
      // Update ticket name
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (trimmed.length > 200) {
        return NextResponse.json(
          { error: "Name must be 200 characters or less" },
          { status: 400 },
        );
      }
      const newName = trimmed || null;

      await db.update(tickets).set({ name: newName }).where(eq(tickets.id, id));
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, id),
        columns: TICKET_COLUMNS,
        with: TICKET_WITH_EVENT,
      });

      // Push the new attendee name to any installed wallet passes.
      await pushWalletUpdate([id], {
        actor: auth.email ?? undefined,
        reason: "ticket.update_name",
        eventId: ticket?.eventId,
        eventName: ticket?.event?.name ?? null,
      });

      await logAuditEvent({
        action: "ticket.update_name",
        actor: auth.email!,
        eventId: ticket!.eventId,
        eventName: ticket!.event?.name ?? null,
        targetEmail: ticket!.email,
        metadata: { ticketId: id, newName },
      });

      return NextResponse.json({
        success: true,
        ticket: await serializeTicketWithFeeWaiver(ticket!),
      });
    } else if (action === "updateTitle") {
      // Update the ticket's internal admin-only title. Unlike updateName this
      // is never reflected on the wallet pass, so no pushWalletUpdate here.
      const trimmed = typeof title === "string" ? title.trim() : "";
      if (trimmed.length > 200) {
        return NextResponse.json(
          { error: "Title must be 200 characters or less" },
          { status: 400 },
        );
      }
      const newTitle = trimmed || null;

      await db.update(tickets).set({ title: newTitle }).where(eq(tickets.id, id));
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, id),
        columns: TICKET_COLUMNS,
        with: TICKET_WITH_EVENT,
      });

      await logAuditEvent({
        action: "ticket.update_title",
        actor: auth.email!,
        eventId: ticket!.eventId,
        eventName: ticket!.event?.name ?? null,
        targetEmail: ticket!.email,
        metadata: { ticketId: id, newTitle },
      });

      return NextResponse.json({
        success: true,
        ticket: await serializeTicketWithFeeWaiver(ticket!),
      });
    } else if (action === "unscan") {
      // Unscan the ticket: set scanned to false and clear scan-related fields
      await db.update(tickets).set({
        scanned: false,
        scanTime: null,
        scanUser: null,
        scanEmail: null,
      }).where(eq(tickets.id, id));
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, id),
        columns: TICKET_COLUMNS,
        with: TICKET_WITH_EVENT,
      });

      try {
        await syncEventScannedCounts();
      } catch (syncError) {
        console.error("Sync scanned RPC error:", syncError);
        return NextResponse.json(
          { error: "Failed to sync scanned" },
          { status: 500 },
        );
      }

      // Revert the wallet pass: un-void it and flip the status back to Active.
      await pushWalletUpdate([id], {
        actor: auth.email ?? undefined,
        reason: "ticket.unscan",
        eventId: ticket?.eventId,
        eventName: ticket?.event?.name ?? null,
      });

      await logAuditEvent({
        action: "ticket.unscan",
        actor: auth.email!,
        eventId: ticket!.eventId,
        eventName: ticket!.event?.name ?? null,
        targetEmail: ticket!.email,
        metadata: { ticketId: id },
      });

      return NextResponse.json({
        success: true,
        ticket: await serializeTicketWithFeeWaiver(ticket!),
      });
    } else if (action === "updateType" || type) {
      // Update ticket type
      if (type !== "VIP" && type !== "STANDARD" && type !== "EXTERNAL" && type !== "STANDBY") {
        return NextResponse.json(
          { error: "Invalid ticket type. Must be 'VIP', 'STANDARD', 'EXTERNAL', or 'STANDBY'." },
          { status: 400 },
        );
      }

      // First, fetch the current ticket to check if type is changing
      const currentTicket = await db.query.tickets.findFirst({
        where: eq(tickets.id, id),
        columns: { type: true, eventId: true },
      });

      if (!currentTicket) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      }

      const typeChanged = currentTicket.type !== type;

      // Block STANDARD→VIP upgrade if VIP capacity is full
      if (typeChanged && type === "VIP" && currentTicket.eventId) {
        const ticketInfo = await getAvailablePublicTickets(
          currentTicket.eventId,
        );
        // CRITICAL: Block upgrade if it would exceed reserved allocation
        if (ticketInfo.vipCount + 1 > ticketInfo.reserved) {
          return NextResponse.json(
            {
              error: `Cannot upgrade to VIP: would exceed reserved allocation (${ticketInfo.vipCount + 1} > ${ticketInfo.reserved})`,
            },
            { status: 400 },
          );
        }
      }

      await db.update(tickets).set({ type }).where(eq(tickets.id, id));
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, id),
        columns: TICKET_COLUMNS,
        with: TICKET_WITH_EVENT_DETAILS,
      });

      // If the type changed, send updated ticket email
      if (typeChanged && ticket) {
        try {
          if (ticket.type === "STANDBY") {
            await sendStandbyLineEmail({
              email: ticket.email,
              name: ticket.name || null,
              eventName: ticket.event?.name || "Event",
              eventStartTime: ticket.event?.startTimeDate?.toISOString() ?? null,
              eventVenue: ticket.event?.venue,
              eventVenueLink: ticket.event?.venueLink,
              eventRoute: ticket.event?.route ?? null,
              standbyOpenTime: formatDoorsOpenTime(ticket.event?.doorsOpen),
              ticketId: ticket.id,
              eventId: ticket.event?.id || null,
              imgVersion: ticket.event?.imgVersion ?? null,
              eventTagline: ticket.event?.tagline || null,
            });
          } else {
            await sendTicketEmail({
              email: ticket.email,
              name: ticket.name || null,
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
              eventId: ticket.event?.id || null,
              imgVersion: ticket.event?.imgVersion ?? null,
              eventTagline: ticket.event?.tagline || null,
            });
          }
        } catch (emailError) {
          console.error("Email sending error:", emailError);
          // Don't fail the update if email fails, just log it
        }
      }

      // Let the shared waitlist helper reconcile any newly available public capacity.
      if (typeChanged && ticket?.eventId) {
        try {
          await pullFromWaitlist(null, ticket.eventId, 1, {
            actor: auth.email!,
            metadata: {
              trigger: "ticket.type_change",
              sourceTicketId: ticket.id,
              oldType: currentTicket.type,
              newType: type,
            },
          });
        } catch (waitlistError) {
          console.error(
            "Waitlist conversion error (non-fatal):",
            waitlistError,
          );
        }
      }

      // Push the new ticket type to any installed wallet passes.
      if (typeChanged) {
        await pushWalletUpdate([id], {
          actor: auth.email ?? undefined,
          reason: "ticket.update_type",
          eventId: ticket?.eventId,
          eventName: ticket?.event?.name ?? null,
        });
      }

      await logAuditEvent({
        action: "ticket.update_type",
        actor: auth.email!,
        eventId: ticket!.eventId,
        eventName: ticket!.event?.name ?? null,
        targetEmail: ticket!.email,
        metadata: { ticketId: id, oldType: currentTicket.type, newType: type },
      });

      return NextResponse.json({
        success: true,
        ticket: await serializeTicketWithFeeWaiver(ticket!),
      });
    } else if (action === "updateScanned" || typeof scanned === "boolean") {
      // Update scanned status
      const updateData: {
        scanned: boolean;
        scanTime?: Date | null;
        scanUser?: string | null;
        scanEmail?: string | null;
      } = {
        scanned,
      };

      // If unscanning, clear scan-related fields
      if (!scanned) {
        updateData.scanTime = null;
        updateData.scanUser = null;
        updateData.scanEmail = null;
      } else {
        // If scanning, set scan_time to now
        updateData.scanTime = new Date();
      }

      await db.update(tickets).set(updateData).where(eq(tickets.id, id));
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, id),
        columns: TICKET_COLUMNS,
        with: TICKET_WITH_EVENT,
      });

      try {
        await syncEventScannedCounts();
      } catch (syncError) {
        console.error("Sync scanned RPC error:", syncError);
        return NextResponse.json(
          { error: "Failed to sync scanned" },
          { status: 500 },
        );
      }

      // Reflect the checked-in/active flip on any installed wallet passes.
      await pushWalletUpdate([id], {
        actor: auth.email ?? undefined,
        reason: "ticket.update_scanned",
        eventId: ticket?.eventId,
        eventName: ticket?.event?.name ?? null,
      });

      return NextResponse.json({
        success: true,
        ticket: await serializeTicketWithFeeWaiver(ticket!),
      });
    } else if (action === "resendEmail") {
      // Resend ticket confirmation email
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, id),
        columns: TICKET_COLUMNS,
        with: TICKET_WITH_EVENT_DETAILS,
      });

      if (!ticket) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      }

      // Send ticket confirmation email
      try {
        await sendTicketEmail({
          email: ticket.email,
          name: ticket.name || null,
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
          eventId: ticket.event?.id || null,
          imgVersion: ticket.event?.imgVersion ?? null,
          eventTagline: ticket.event?.tagline || null,
        });
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        return NextResponse.json(
          { error: "Failed to send email" },
          { status: 500 },
        );
      }

      await logAuditEvent({
        action: "email.send",
        actor: auth.email!,
        eventId: ticket.eventId,
        eventName: ticket.event?.name ?? null,
        targetEmail: ticket.email,
        metadata: { type: "resendEmail", ticketId: id },
      });

      return NextResponse.json({
        success: true,
        message: "Email sent successfully",
      });
    } else if (action === "sendDayOfReminders") {
      // Send day-of reminder emails to all ticket holders for an event
      const { searchParams } = new URL(req.url);
      const eventId = searchParams.get("eventId");

      if (!eventId) {
        return NextResponse.json(
          { error: "Event ID is required" },
          { status: 400 },
        );
      }

      if (!isValidUUID(eventId)) {
        return NextResponse.json(
          { error: "Invalid event ID format" },
          { status: 400 },
        );
      }

      // Fetch event details including doors_open time
      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          id: true,
          name: true,
          route: true,
          startTimeDate: true,
          endTimeDate: true,
          doorsOpen: true,
          venue: true,
          venueLink: true,
          desc: true,
          tagline: true,
          imgVersion: true,
        },
      });

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      const hasTicketIdFilter = Array.isArray(ticketIds);
      const normalizedTicketIds = hasTicketIdFilter
        ? [...new Set(
          ticketIds.filter(
            (ticketId): ticketId is string =>
              typeof ticketId === "string" && ticketId.trim().length > 0,
          ),
        )]
        : [];

      if (hasTicketIdFilter && normalizedTicketIds.length === 0) {
        return NextResponse.json(
          { error: "ticketIds must be a non-empty array of strings" },
          { status: 400 },
        );
      }

      if (normalizedTicketIds.length > REMINDER_EMAIL_BATCH_SIZE) {
        return NextResponse.json(
          {
            error:
              `Maximum ${REMINDER_EMAIL_BATCH_SIZE} ticketIds per reminder request`,
          },
          { status: 400 },
        );
      }

      // Fetch all tickets for this event (or the requested ticket chunk)
      const eventTickets = await db.query.tickets.findMany({
        where: hasTicketIdFilter
          ? and(eq(tickets.eventId, eventId), inArray(tickets.id, normalizedTicketIds))
          : eq(tickets.eventId, eventId),
        columns: { id: true, email: true, name: true, type: true },
      });

      if (!eventTickets || eventTickets.length === 0) {
        return NextResponse.json({
          success: true,
          sent: 0,
          failed: 0,
          message: "No tickets found for this event",
        });
      }

      // Reminders are event-essential — they go to every ticket holder
      // regardless of any mailing-list opt-out. The email itself shows a
      // "you got a ticket to X" footer in place of an unsubscribe link.
      // Hard-suppressed addresses are still dropped (admin kill switch).
      const dayOfSuppressed = await partitionBySuppression(
        eventTickets.map((t) => t.email),
      );
      const dayOfSuppressedSet = new Set(
        dayOfSuppressed.suppressed.map((e) => e.trim().toLowerCase()),
      );
      const dayOfRecipients = eventTickets.filter(
        (t) => !dayOfSuppressedSet.has(t.email.trim().toLowerCase()),
      );

      const { sent, failed, errors, failures, sentEmails } = await sendReminderBatch({
        recipients: dayOfRecipients,
        batchSize: hasTicketIdFilter
          ? normalizedTicketIds.length
          : REMINDER_EMAIL_BATCH_SIZE,
        minBatchDurationMs: REMINDER_EMAIL_MIN_BATCH_DURATION_MS,
        sendEmail: (ticket) =>
          sendDayOfReminderEmail({
            email: ticket.email,
            name: ticket.name || null,
            eventName: event.name || "Event",
            ticketType: ticket.type || "STANDARD",
            eventStartTime: event.startTimeDate?.toISOString() || null,
            eventEndTime: event.endTimeDate?.toISOString() || null,
            eventRoute: event.route || null,
            ticketId: ticket.id,
            eventVenue: event.venue || null,
            eventVenueLink: event.venueLink || null,
            eventDescription: event.desc || null,
            doorsOpenTime: event.doorsOpen?.toISOString() || null,
            eventId: event.id,
            imgVersion: event.imgVersion,
            eventTagline: event.tagline || null,
          }),
        logPrefix: "Failed to send reminder to",
      });

      await logSendFailures({
        failures,
        actor: auth.email!,
        source: "reminders.day_of",
        batchId: normalizedAuditBatchId,
        eventId,
        eventName: event.name ?? null,
      });

      await logAuditEvent({
        action: "email.send_mass",
        actor: auth.email!,
        eventId: eventId,
        eventName: event.name ?? null,
        metadata: {
          type: "dayOfReminders",
          sent,
          failed,
          suppressed: dayOfSuppressed.suppressed.length,
          total: eventTickets.length,
          ...(normalizedAuditBatchId ? { batchId: normalizedAuditBatchId } : {}),
          recipients: sentEmails,
        },
      });

      return NextResponse.json({
        success: true,
        sent,
        failed,
        suppressed: dayOfSuppressed.suppressed.length,
        total: eventTickets.length,
        message: `Sent ${sent} reminder(s), ${failed} failed`,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else if (action === "sendDayOfReminder") {
      // Send day-of reminder email to a single ticket holder
      if (!id) {
        return NextResponse.json(
          { error: "Ticket ID is required" },
          { status: 400 },
        );
      }

      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, id),
        columns: TICKET_COLUMNS,
        with: TICKET_WITH_DOORS_OPEN,
      });

      if (!ticket) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      }

      try {
        await sendDayOfReminderEmail({
          email: ticket.email,
          name: ticket.name || null,
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
          eventId: ticket.event?.id || null,
          imgVersion: ticket.event?.imgVersion ?? null,
          eventTagline: ticket.event?.tagline || null,
        });
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        return NextResponse.json(
          { error: "Failed to send reminder email" },
          { status: 500 },
        );
      }

      await logAuditEvent({
        action: "email.send",
        actor: auth.email!,
        eventId: ticket.eventId,
        eventName: ticket.event?.name ?? null,
        targetEmail: ticket.email,
        metadata: { type: "dayOfReminder", ticketId: id },
      });

      return NextResponse.json({
        success: true,
        message: "Day-of reminder sent successfully",
      });
    } else if (action === "sendEarlyReminders") {
      // Send early reminder emails to all ticket holders for an event
      const { searchParams } = new URL(req.url);
      const eventId = searchParams.get("eventId");

      if (!eventId) {
        return NextResponse.json(
          { error: "Event ID is required" },
          { status: 400 },
        );
      }

      if (!isValidUUID(eventId)) {
        return NextResponse.json(
          { error: "Invalid event ID format" },
          { status: 400 },
        );
      }

      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          id: true,
          name: true,
          route: true,
          startTimeDate: true,
          endTimeDate: true,
          doorsOpen: true,
          venue: true,
          venueLink: true,
          desc: true,
          tagline: true,
          imgVersion: true,
        },
      });

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      const hasTicketIdFilter = Array.isArray(ticketIds);
      const normalizedTicketIds = hasTicketIdFilter
        ? [...new Set(
          ticketIds.filter(
            (ticketId): ticketId is string =>
              typeof ticketId === "string" && ticketId.trim().length > 0,
          ),
        )]
        : [];

      if (hasTicketIdFilter && normalizedTicketIds.length === 0) {
        return NextResponse.json(
          { error: "ticketIds must be a non-empty array of strings" },
          { status: 400 },
        );
      }

      if (normalizedTicketIds.length > REMINDER_EMAIL_BATCH_SIZE) {
        return NextResponse.json(
          {
            error:
              `Maximum ${REMINDER_EMAIL_BATCH_SIZE} ticketIds per reminder request`,
          },
          { status: 400 },
        );
      }

      const eventTickets = await db.query.tickets.findMany({
        where: hasTicketIdFilter
          ? and(eq(tickets.eventId, eventId), inArray(tickets.id, normalizedTicketIds))
          : eq(tickets.eventId, eventId),
        columns: { id: true, email: true, name: true, type: true },
      });

      if (!eventTickets || eventTickets.length === 0) {
        return NextResponse.json({
          success: true,
          sent: 0,
          failed: 0,
          message: "No tickets found for this event",
        });
      }

      // Reminders are event-essential — see comment in sendDayOfReminders.
      const earlySuppressed = await partitionBySuppression(
        eventTickets.map((t) => t.email),
      );
      const earlySuppressedSet = new Set(
        earlySuppressed.suppressed.map((e) => e.trim().toLowerCase()),
      );
      const earlyRecipients = eventTickets.filter(
        (t) => !earlySuppressedSet.has(t.email.trim().toLowerCase()),
      );

      const { sent, failed, errors, failures, sentEmails } = await sendReminderBatch({
        recipients: earlyRecipients,
        batchSize: hasTicketIdFilter
          ? normalizedTicketIds.length
          : REMINDER_EMAIL_BATCH_SIZE,
        minBatchDurationMs: REMINDER_EMAIL_MIN_BATCH_DURATION_MS,
        sendEmail: (ticket) =>
          sendEarlyReminderEmail({
            email: ticket.email,
            name: ticket.name || null,
            eventName: event.name || "Event",
            ticketType: ticket.type || "STANDARD",
            eventStartTime: event.startTimeDate?.toISOString() || null,
            eventEndTime: event.endTimeDate?.toISOString() || null,
            eventRoute: event.route || null,
            ticketId: ticket.id,
            eventVenue: event.venue || null,
            eventVenueLink: event.venueLink || null,
            eventDescription: event.desc || null,
            doorsOpenTime: event.doorsOpen?.toISOString() || null,
            promo: promo || null,
            eventId: event.id,
            imgVersion: event.imgVersion,
            eventTagline: event.tagline || null,
          }),
        logPrefix: "Failed to send early reminder to",
      });

      await logSendFailures({
        failures,
        actor: auth.email!,
        source: "reminders.early",
        batchId: normalizedAuditBatchId,
        eventId,
        eventName: event.name ?? null,
      });

      await logAuditEvent({
        action: "email.send_mass",
        actor: auth.email!,
        eventId: eventId,
        eventName: event.name ?? null,
        metadata: {
          type: "earlyReminders",
          sent,
          failed,
          suppressed: earlySuppressed.suppressed.length,
          total: eventTickets.length,
          ...(normalizedAuditBatchId ? { batchId: normalizedAuditBatchId } : {}),
          recipients: sentEmails,
        },
      });

      return NextResponse.json({
        success: true,
        sent,
        failed,
        suppressed: earlySuppressed.suppressed.length,
        total: eventTickets.length,
        message: `Sent ${sent} early reminder(s), ${failed} failed`,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else if (action === "sendEarlyReminder") {
      // Send early reminder email to a single ticket holder
      if (!id) {
        return NextResponse.json(
          { error: "Ticket ID is required" },
          { status: 400 },
        );
      }

      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, id),
        columns: TICKET_COLUMNS,
        with: TICKET_WITH_DOORS_OPEN,
      });

      if (!ticket) {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 },
        );
      }

      try {
        await sendEarlyReminderEmail({
          email: ticket.email,
          name: ticket.name || null,
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
          promo: promo || null,
          eventId: ticket.event?.id || null,
          imgVersion: ticket.event?.imgVersion ?? null,
          eventTagline: ticket.event?.tagline || null,
        });
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        return NextResponse.json(
          { error: "Failed to send early reminder email" },
          { status: 500 },
        );
      }

      await logAuditEvent({
        action: "email.send",
        actor: auth.email!,
        eventId: ticket.eventId,
        eventName: ticket.event?.name ?? null,
        targetEmail: ticket.email,
        metadata: { type: "earlyReminder", ticketId: id },
      });

      return NextResponse.json({
        success: true,
        message: "Early reminder sent successfully",
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Invalid action. Use 'updateName', 'updateTitle', 'unscan', 'updateType', 'updateScanned', 'resendEmail', 'sendDayOfReminders', 'sendDayOfReminder', 'sendEarlyReminders', 'sendEarlyReminder'.",
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, eventId, type, name } = body;
    const titleInput = typeof body.title === "string" ? body.title.trim() : "";
    const newTitle = titleInput || null;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("tickets.edit", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Check if event exists
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { id: true, name: true, capacity: true, reserved: true, doorsOpen: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check capacity constraints for new tickets (only if event has capacity set)
    const ticketType = type || "VIP"; // Admin-created tickets default to VIP
    if (event.capacity) {
      const ticketInfo = await getAvailablePublicTickets(eventId);

      if (ticketType === "VIP") {
        // CRITICAL: Block VIP creation if it would exceed reserved allocation
        if (ticketInfo.vipCount + 1 > ticketInfo.reserved) {
          return NextResponse.json(
            {
              error: `Cannot add VIP ticket: would exceed reserved allocation (${ticketInfo.vipCount + 1} > ${ticketInfo.reserved})`,
            },
            { status: 400 },
          );
        }
      }
    }

    // Check if user already has a ticket for this event
    const existingTicket = await db.query.tickets.findFirst({
      where: and(eq(tickets.eventId, eventId), eq(tickets.email, email)),
      columns: { id: true, type: true, name: true },
    });

    if (existingTicket) {
      const newType = type || "VIP";
      const typeChanged = existingTicket.type !== newType;
      const nameChanged =
        typeof name === "string" &&
        name.length > 0 &&
        existingTicket.name !== name;

      // If upgrading to VIP from non-VIP, check VIP capacity
      if (
        newType === "VIP" &&
        existingTicket.type !== "VIP" &&
        event.capacity
      ) {
        const ticketInfo = await getAvailablePublicTickets(eventId);
        if (ticketInfo.vipCount + 1 > ticketInfo.reserved) {
          return NextResponse.json(
            {
              error: `Cannot upgrade to VIP: would exceed reserved allocation (${ticketInfo.vipCount + 1} > ${ticketInfo.reserved})`,
            },
            { status: 400 },
          );
        }
      }

      // Update the existing ticket's type (and name if provided)
      await db.update(tickets)
        .set({ type: newType, ...(name ? { name } : {}), ...(titleInput ? { title: newTitle } : {}) })
        .where(eq(tickets.id, existingTicket.id));
      const updatedTicket = await db.query.tickets.findFirst({
        where: eq(tickets.id, existingTicket.id),
        columns: TICKET_COLUMNS,
        with: TICKET_WITH_EVENT_DETAILS,
      });

      // Remove the stale waitlist entry through the DB RPC so positions stay contiguous.
      try {
        await removeWaitlistEntryForEmail(eventId, email);
      } catch (waitlistError) {
        console.error("Waitlist removal error (non-fatal):", waitlistError);
      }

      // Only send email if the type actually changed
      if (typeChanged && updatedTicket) {
        try {
          if (updatedTicket.type === "STANDBY") {
            await sendStandbyLineEmail({
              email: updatedTicket.email,
              name: updatedTicket.name || null,
              eventName: updatedTicket.event?.name || "Event",
              eventStartTime: updatedTicket.event?.startTimeDate?.toISOString() ?? null,
              eventVenue: updatedTicket.event?.venue,
              eventVenueLink: updatedTicket.event?.venueLink,
              eventRoute: updatedTicket.event?.route ?? null,
              standbyOpenTime: formatDoorsOpenTime(updatedTicket.event?.doorsOpen),
              ticketId: updatedTicket.id,
              eventId: updatedTicket.event?.id || null,
              imgVersion: updatedTicket.event?.imgVersion ?? null,
              eventTagline: updatedTicket.event?.tagline || null,
            });
          } else {
            await sendTicketEmail({
              email: updatedTicket.email,
              name: updatedTicket.name || null,
              eventName: updatedTicket.event?.name || "Event",
              ticketType: updatedTicket.type || "VIP",
              eventStartTime: updatedTicket.event?.startTimeDate?.toISOString() || null,
              eventEndTime: updatedTicket.event?.endTimeDate?.toISOString() || null,
              eventRoute: updatedTicket.event?.route || null,
              ticketId: updatedTicket.id,
              eventVenue: updatedTicket.event?.venue || null,
              eventVenueLink: updatedTicket.event?.venueLink || null,
              eventDescription: updatedTicket.event?.desc || null,
              doorsOpenTime: updatedTicket.event?.doorsOpen?.toISOString() || null,
              eventId: updatedTicket.event?.id || null,
              imgVersion: updatedTicket.event?.imgVersion ?? null,
              eventTagline: updatedTicket.event?.tagline || null,
            });
          }
        } catch (emailError) {
          console.error("Email sending error (non-fatal):", emailError);
        }
      }

      // Reconcile any capacity change created by the new ticket type.
      if (typeChanged && updatedTicket?.eventId) {
        try {
          await pullFromWaitlist(null, updatedTicket.eventId, 1, {
            actor: auth.email!,
            metadata: {
              trigger: "ticket.type_change",
              sourceTicketId: updatedTicket.id,
              oldType: existingTicket.type,
              newType: updatedTicket.type,
              updated: true,
            },
          });
        } catch (waitlistError) {
          console.error(
            "Waitlist conversion error (non-fatal):",
            waitlistError,
          );
        }
      }

      if (typeChanged || nameChanged) {
        await pushWalletUpdate([existingTicket.id], {
          actor: auth.email ?? undefined,
          reason: nameChanged && typeChanged
            ? "ticket.update_existing"
            : nameChanged
              ? "ticket.update_name"
              : "ticket.update_type",
          eventId,
        });
      }

      await logAuditEvent({
        action: typeChanged ? "ticket.update_type" : "ticket.create",
        actor: auth.email!,
        eventId: eventId,
        eventName: updatedTicket!.event?.name ?? null,
        targetEmail: email,
        metadata: typeChanged
          ? {
              ticketId: updatedTicket!.id,
              oldType: existingTicket.type,
              newType: updatedTicket!.type,
              trigger: "ticket.create_existing_email",
            }
          : {
              ticketId: updatedTicket!.id,
              type: updatedTicket!.type,
              updated: true,
              trigger: "ticket.create_existing_email",
            },
      });

      return NextResponse.json({
        success: true,
        ticket: await serializeTicketWithFeeWaiver(updatedTicket!),
        updated: true,
      });
    }

    // Create the VIP ticket
    const [inserted] = await db.insert(tickets).values({
      eventId: eventId,
      email: email,
      name: name || null,
      title: newTitle,
      type: type || "VIP",
    }).returning();
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, inserted.id),
      columns: TICKET_COLUMNS,
      with: TICKET_WITH_EVENT_DETAILS,
    });

    // Remove the stale waitlist entry through the DB RPC so positions stay contiguous.
    try {
      await removeWaitlistEntryForEmail(eventId, email);
    } catch (waitlistError) {
      console.error("Waitlist removal error (non-fatal):", waitlistError);
    }

    // Send ticket confirmation email
    try {
      if (ticket!.type === "STANDBY") {
        await sendStandbyLineEmail({
          email: ticket!.email,
          name: ticket!.name || null,
          eventName: ticket!.event?.name || "Event",
          eventStartTime: ticket!.event?.startTimeDate?.toISOString() ?? null,
          eventVenue: ticket!.event?.venue,
          eventVenueLink: ticket!.event?.venueLink,
          eventRoute: ticket!.event?.route ?? null,
          standbyOpenTime: formatDoorsOpenTime(event.doorsOpen),
          ticketId: ticket!.id,
          eventId: ticket!.event?.id || null,
          imgVersion: ticket!.event?.imgVersion ?? null,
          eventTagline: ticket!.event?.tagline || null,
        });
      } else {
        await sendTicketEmail({
          email: ticket!.email,
          name: ticket!.name || null,
          eventName: ticket!.event?.name || "Event",
          ticketType: ticket!.type || "VIP",
          eventStartTime: ticket!.event?.startTimeDate?.toISOString() || null,
          eventEndTime: ticket!.event?.endTimeDate?.toISOString() || null,
          eventRoute: ticket!.event?.route || null,
          ticketId: ticket!.id,
          eventVenue: ticket!.event?.venue || null,
          eventVenueLink: ticket!.event?.venueLink || null,
          eventDescription: ticket!.event?.desc || null,
          doorsOpenTime: ticket!.event?.doorsOpen?.toISOString() || null,
          eventId: ticket!.event?.id || null,
          imgVersion: ticket!.event?.imgVersion ?? null,
          eventTagline: ticket!.event?.tagline || null,
        });
      }
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // Ticket was created but email failed - return error
      return NextResponse.json(
        {
          error:
            "Ticket was created but failed to send confirmation email. Please contact support.",
        },
        { status: 500 },
      );
    }

    await logAuditEvent({
      action: "ticket.create",
      actor: auth.email!,
      eventId: eventId,
      eventName: ticket!.event?.name ?? null,
      targetEmail: email,
      metadata: { ticketId: ticket!.id, type: ticket!.type },
    });
    await recordMailingListMember({
      email,
      source: "ticket_admin",
      actor: auth.email!,
    });

    return NextResponse.json({
      success: true,
      ticket: await serializeTicketWithFeeWaiver(ticket!),
    });
  } catch (error) {
    console.error("Ticket creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
