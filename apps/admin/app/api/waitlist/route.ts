import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { isValidUUID } from "@/app/lib/validation";
import { sendStandbyLineEmail, sendTicketEmail } from "@/app/lib/email";
import {
  PACIFIC_TIMEZONE,
  REMINDER_EMAIL_BATCH_SIZE,
} from "@/app/lib/constants";
import { removeWaitlistEntryForEmail } from "@/app/lib/waitlist";
import {
  db,
  eq,
  and,
  sql,
  inArray,
  waitlist,
  events,
  tickets,
  walletVoidedPasses,
} from "@ssb/db";
import { pushWalletUpdate } from "@/app/lib/wallet-push";
import { logAuditEvent } from "@/app/lib/audit";
import {
  logSendFailures,
  partitionBySuppression,
} from "@/app/lib/email-suppression";

async function sendWithRetry(
  fn: () => Promise<void>,
  maxAttempts = 4,
): Promise<void> {
  let delay = 500;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    const auth = await requirePermission("tickets.view", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // If eventId is provided, validate and return single event waitlist
    if (eventId) {
      if (!isValidUUID(eventId)) {
        return NextResponse.json(
          { error: "Invalid event ID format" },
          { status: 400 },
        );
      }

      // Get event details
      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          id: true,
          name: true,
          capacity: true,
          reserved: true,
          startTimeDate: true,
          venue: true,
          standbyEnabled: true,
        },
      });

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      // Get waitlist for this event
      const waitlistEntries = await db.query.waitlist.findMany({
        where: eq(waitlist.eventId, eventId),
        columns: {
          id: true,
          email: true,
          name: true,
          referral: true,
          position: true,
          createdAt: true,
        },
        orderBy: (t, { asc }) => [asc(t.position)],
      });

      return NextResponse.json(
        {
          event: {
            id: event.id,
            name: event.name,
            capacity: event.capacity,
            reserved: event.reserved ?? null,
            start_time_date: event.startTimeDate?.toISOString() ?? null,
            venue: event.venue,
            standbyMode: event.standbyEnabled,
          },
          waitlist: waitlistEntries.map((e) => ({
            id: e.id,
            email: e.email,
            name: e.name,
            referral: e.referral,
            position: e.position,
            created_at: e.createdAt.toISOString(),
          })),
          totalCount: waitlistEntries.length,
          grouped: false,
        },
        { status: 200 },
      );
    }

    // No eventId - return all waitlist entries grouped by event
    const allWaitlistEntries = await db.query.waitlist.findMany({
      columns: {
        id: true,
        email: true,
        name: true,
        referral: true,
        position: true,
        createdAt: true,
        eventId: true,
      },
      with: {
        event: {
          columns: {
            id: true,
            name: true,
            capacity: true,
            reserved: true,
            startTimeDate: true,
            venue: true,
          },
        },
      },
      orderBy: (t, { desc, asc }) => [desc(t.eventId), asc(t.position)],
    });

    // Group by event
    const groupedByEvent: Record<
      string,
      {
        event: {
          id: string;
          name: string | null;
          capacity: number;
          reserved: number | null;
          start_time_date: string | null;
          venue: string | null;
        };
        waitlist: Array<{
          id: string;
          email: string;
          name: string | null;
          referral: string | null;
          position: number;
          created_at: string;
        }>;
        totalCount: number;
      }
    > = {};

    allWaitlistEntries.forEach((entry) => {
      const evtId = entry.eventId;
      if (!evtId || !entry.event) return;

      if (!groupedByEvent[evtId]) {
        groupedByEvent[evtId] = {
          event: {
            id: entry.event.id,
            name: entry.event.name,
            capacity: entry.event.capacity,
            reserved: entry.event.reserved ?? null,
            start_time_date: entry.event.startTimeDate?.toISOString() ?? null,
            venue: entry.event.venue,
          },
          waitlist: [],
          totalCount: 0,
        };
      }

      groupedByEvent[evtId].waitlist.push({
        id: entry.id,
        email: entry.email,
        name: entry.name,
        referral: entry.referral,
        position: entry.position,
        created_at: entry.createdAt.toISOString(),
      });
      groupedByEvent[evtId].totalCount++;
    });

    return NextResponse.json(
      {
        leaderboard: Object.values(groupedByEvent),
        grouped: true,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Admin waitlist fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Disabling standby can offer to migrate existing standby tickets either
    // back onto the waitlist or up to regular tickets. That conversion runs
    // through this same route under an explicit action discriminator.
    if (body?.action === "convert_standby") {
      return handleConvertStandby(body);
    }

    // Issuing standby tickets to the waitlist runs through the shared bulk-send
    // system: the client chunks the waitlist and posts one chunk per request
    // (each tagged with the same auditBatchId), mirroring sendDayOfReminders.
    if (body?.action === "sendStandbyEmails") {
      return handleSendStandbyEmails(body);
    }

    return NextResponse.json(
      { error: "Unknown or missing action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Admin waitlist POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

type SendStandbyBody = {
  eventId?: unknown;
  waitlistIds?: unknown;
  auditBatchId?: unknown;
  waitlistOpenTime?: unknown;
  expectedCapacity?: unknown;
};

/**
 * Issue STANDBY tickets to one chunk of waitlist entries and email each holder.
 *
 * This is the per-chunk worker for the shared bulk-send flow (runChunkedSend on
 * the client). It accepts a bounded list of waitlist row IDs, drops
 * hard-suppressed addresses, skips anyone who already holds a ticket, and for
 * the rest creates a STANDBY ticket, sends the standby-line email, and removes
 * them from the waitlist. Returns the categorized counts the bulk-send progress
 * UI expects ({ sent, failed, skippedHasTicket, suppressed }).
 */
async function handleSendStandbyEmails(body: SendStandbyBody) {
  const eventId = typeof body.eventId === "string" ? body.eventId : null;

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  if (!isValidUUID(eventId)) {
    return NextResponse.json(
      { error: "Invalid event ID format" },
      { status: 400 },
    );
  }

  const auth = await requirePermission("tickets.edit", eventId);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const rawIds = Array.isArray(body.waitlistIds) ? body.waitlistIds : null;
  if (!rawIds) {
    return NextResponse.json(
      { error: "waitlistIds must be an array of strings" },
      { status: 400 },
    );
  }
  const waitlistIds = [
    ...new Set(
      rawIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      ),
    ),
  ];
  if (waitlistIds.length === 0) {
    return NextResponse.json(
      { error: "waitlistIds must be a non-empty array of strings" },
      { status: 400 },
    );
  }
  if (waitlistIds.length > REMINDER_EMAIL_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Maximum ${REMINDER_EMAIL_BATCH_SIZE} waitlistIds per request` },
      { status: 400 },
    );
  }

  const auditBatchId =
    typeof body.auditBatchId === "string" && body.auditBatchId.trim().length > 0
      ? body.auditBatchId.trim()
      : null;
  const waitlistOpenTime =
    typeof body.waitlistOpenTime === "string" ? body.waitlistOpenTime : undefined;
  const expectedCapacity =
    typeof body.expectedCapacity === "string" ? body.expectedCapacity : undefined;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: {
      id: true,
      name: true,
      route: true,
      startTimeDate: true,
      doorsOpen: true,
      venue: true,
      venueLink: true,
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Only operate on the rows in this chunk that still exist on the waitlist —
  // a concurrent run (or an earlier chunk's cleanup) may have already cleared
  // some of them.
  const entries = await db.query.waitlist.findMany({
    where: and(
      eq(waitlist.eventId, eventId),
      inArray(waitlist.id, waitlistIds),
    ),
    columns: { id: true, email: true, name: true },
  });

  if (entries.length === 0) {
    return NextResponse.json({
      success: true,
      sent: 0,
      failed: 0,
      skippedHasTicket: 0,
      suppressed: 0,
      total: 0,
    });
  }

  // Hard-suppressed addresses (admin kill switch) are dropped entirely: we
  // neither issue them a standby ticket nor email them, and they stay on the
  // waitlist so the suppressed count stays visible to the admin.
  const suppression = await partitionBySuppression(entries.map((e) => e.email));
  const suppressedSet = new Set(
    suppression.suppressed.map((e) => e.trim().toLowerCase()),
  );
  const sendable = entries.filter(
    (e) => !suppressedSet.has(e.email.trim().toLowerCase()),
  );

  // Format doors open time from event, falling back to request body or default
  const doorsOpenFormatted = event.doorsOpen
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: PACIFIC_TIMEZONE,
      }).format(new Date(event.doorsOpen))
    : (waitlistOpenTime ?? "7:30 PM");

  type Outcome = {
    category: "sent" | "skippedHasTicket" | "failed";
    email: string;
    error?: unknown;
  };

  const outcomes: Outcome[] = await Promise.all(
    sendable.map(async (entry): Promise<Outcome> => {
      try {
        const existingTicket = await db.query.tickets.findFirst({
          where: and(
            eq(tickets.eventId, eventId),
            eq(tickets.email, entry.email),
          ),
          columns: { id: true },
        });

        if (existingTicket) {
          try {
            await removeWaitlistEntryForEmail(eventId, entry.email);
          } catch (waitlistError) {
            console.error(
              "Waitlist cleanup after existing ticket failed:",
              waitlistError,
            );
          }
          return { category: "skippedHasTicket", email: entry.email };
        }

        // Create STANDBY ticket
        const [inserted] = await db
          .insert(tickets)
          .values({
            eventId,
            email: entry.email,
            name: entry.name ?? null,
            type: "STANDBY",
          })
          .returning({ id: tickets.id });

        await sendWithRetry(() =>
          sendStandbyLineEmail({
            email: entry.email,
            name: entry.name,
            eventName: event.name || "Event",
            eventStartTime: event.startTimeDate?.toISOString() ?? null,
            eventVenue: event.venue,
            eventVenueLink: event.venueLink,
            eventRoute: event.route,
            standbyOpenTime: doorsOpenFormatted,
            expectedCapacity: expectedCapacity || "100-200",
            ticketId: inserted.id,
          }),
        );

        try {
          await removeWaitlistEntryForEmail(eventId, entry.email);
        } catch (waitlistError) {
          console.error(
            "Waitlist removal after standby issuance failed:",
            waitlistError,
          );
        }
        return { category: "sent", email: entry.email };
      } catch (error) {
        console.error(
          `Failed to issue standby ticket for ${entry.email}:`,
          error,
        );
        return { category: "failed", email: entry.email, error };
      }
    }),
  );

  const sentEmails = outcomes
    .filter((o) => o.category === "sent")
    .map((o) => o.email);
  const sent = sentEmails.length;
  const skippedHasTicket = outcomes.filter(
    (o) => o.category === "skippedHasTicket",
  ).length;
  const failures = outcomes.filter((o) => o.category === "failed");
  const failed = failures.length;
  const suppressed = entries.length - sendable.length;

  await logSendFailures({
    failures: failures.map((f) => ({ email: f.email, error: f.error })),
    actor: auth.email!,
    source: "waitlist.issue_standby",
    batchId: auditBatchId,
    eventId,
    eventName: event.name ?? null,
  });

  await logAuditEvent({
    action: "email.send_mass",
    actor: auth.email!,
    eventId,
    eventName: event.name ?? null,
    metadata: {
      type: "standbyLine",
      sent,
      failed,
      skippedHasTicket,
      suppressed,
      total: entries.length,
      ...(auditBatchId ? { batchId: auditBatchId } : {}),
      recipients: sentEmails,
    },
  });

  return NextResponse.json({
    success: true,
    sent,
    failed,
    skippedHasTicket,
    suppressed,
    total: entries.length,
  });
}

type ConvertStandbyBody = {
  eventId?: unknown;
  mode?: unknown;
};

/**
 * Migrate an event's existing STANDBY tickets when standby mode is turned off.
 *
 * - mode "regular": flip each STANDBY ticket to STANDARD and send the normal
 *   ticket confirmation (they now hold a guaranteed ticket). The type-counter
 *   trigger keeps public_tickets_sold/standby_tickets_sold accurate.
 * - mode "waitlist": tombstone the pass, delete the ticket, and re-add the
 *   person to the back of the waitlist silently (no email). Mirrors the
 *   cancel/delete wallet flow so installed passes flip to voided.
 *
 * Per-ticket failures are collected, not fatal. The wallet push and audit log
 * are best-effort.
 */
async function handleConvertStandby(body: ConvertStandbyBody) {
  const eventId = typeof body.eventId === "string" ? body.eventId : null;
  const mode = body.mode;

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  if (!isValidUUID(eventId)) {
    return NextResponse.json(
      { error: "Invalid event ID format" },
      { status: 400 },
    );
  }
  if (mode !== "regular" && mode !== "waitlist") {
    return NextResponse.json(
      { error: "mode must be 'regular' or 'waitlist'" },
      { status: 400 },
    );
  }

  const auth = await requirePermission("tickets.edit", eventId);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
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
      tagline: true,
      imgVersion: true,
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const standbyTickets = await db.query.tickets.findMany({
    where: and(eq(tickets.eventId, eventId), eq(tickets.type, "STANDBY")),
    columns: { id: true, email: true, name: true },
  });

  if (standbyTickets.length === 0) {
    return NextResponse.json({ success: true, converted: 0, errors: 0, mode });
  }

  let converted = 0;
  let errorCount = 0;
  // Serials of tickets whose installed passes need a refresh push: an upgrade
  // to STANDARD (mode "regular") or a flip to voided (mode "waitlist", where
  // the row is gone but the tombstone serves a voided pass).
  const pushIds: string[] = [];

  if (mode === "regular") {
    for (const ticket of standbyTickets) {
      try {
        await db
          .update(tickets)
          .set({ type: "STANDARD" })
          .where(eq(tickets.id, ticket.id));
        pushIds.push(ticket.id);
        converted++;

        try {
          await sendWithRetry(() =>
            sendTicketEmail({
              email: ticket.email,
              name: ticket.name || null,
              eventName: event.name || "Event",
              ticketType: "STANDARD",
              eventStartTime: event.startTimeDate?.toISOString() || null,
              eventEndTime: event.endTimeDate?.toISOString() || null,
              eventRoute: event.route || null,
              ticketId: ticket.id,
              eventVenue: event.venue || null,
              eventVenueLink: event.venueLink || null,
              eventDescription: event.desc || null,
              doorsOpenTime: event.doorsOpen?.toISOString() || null,
              eventId: event.id,
              imgVersion: event.imgVersion ?? null,
              eventTagline: event.tagline || null,
            }),
          );
        } catch (emailError) {
          console.error(
            `Standby→regular email failed for ${ticket.email} (non-fatal):`,
            emailError,
          );
        }
      } catch (err) {
        errorCount++;
        console.error(
          `Failed to convert standby ticket ${ticket.id} to regular:`,
          err,
        );
      }
    }
  } else {
    // mode === "waitlist": append to the back of the waitlist. Compute the
    // starting position once and increment locally as we insert.
    const [{ maxPos } = { maxPos: 0 }] = await db
      .select({
        maxPos: sql<number>`COALESCE(MAX(${waitlist.position}), 0)`,
      })
      .from(waitlist)
      .where(eq(waitlist.eventId, eventId));
    let nextPosition = Number(maxPos) || 0;

    for (const ticket of standbyTickets) {
      try {
        // Tombstone first so a poll that lands after the delete still renders a
        // voided pass from the event row (mirrors the cancel/delete flow).
        await db
          .insert(walletVoidedPasses)
          .values({
            serialNumber: ticket.id,
            email: ticket.email,
            name: ticket.name ?? null,
            ticketType: "STANDBY",
            eventId,
          })
          .onConflictDoNothing();

        await db.delete(tickets).where(eq(tickets.id, ticket.id));

        nextPosition++;
        await db
          .insert(waitlist)
          .values({
            eventId,
            email: ticket.email,
            name: ticket.name ?? null,
            referral: null,
            position: nextPosition,
          })
          .onConflictDoNothing();

        pushIds.push(ticket.id);
        converted++;
      } catch (err) {
        errorCount++;
        console.error(
          `Failed to convert standby ticket ${ticket.id} to waitlist:`,
          err,
        );
      }
    }
  }

  try {
    await pushWalletUpdate(pushIds, {
      actor: auth.email ?? undefined,
      reason:
        mode === "regular"
          ? "standby.convert_regular"
          : "standby.convert_waitlist",
      eventId,
      eventName: event.name ?? null,
    });
  } catch (pushError) {
    console.error(
      "Wallet push after standby conversion failed (non-fatal):",
      pushError,
    );
  }

  await logAuditEvent({
    action: "waitlist.convert_standby",
    actor: auth.email!,
    eventId,
    eventName: event.name ?? null,
    metadata: {
      mode,
      converted,
      errors: errorCount,
      total: standbyTickets.length,
    },
  });

  return NextResponse.json({ success: true, converted, errors: errorCount, mode });
}
