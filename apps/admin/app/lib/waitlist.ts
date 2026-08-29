import { getAvailablePublicTickets } from "@/app/lib/supabase";
import {
  db,
  and,
  eq,
  gt,
  inArray,
  sql,
  events,
  referrals,
  tickets,
  waitlist,
} from "@ssb/db";
import { sendTicketEmail } from "@/app/lib/email";
import { logAuditEvent } from "@/app/lib/audit";
import {
  getFeeWaiverEmailSetForEmails,
  normalizeEmail,
} from "@/app/lib/auth";

const WAITLIST_BATCH_MULTIPLIER = 5;
const MIN_WAITLIST_BATCH_SIZE = 50;

type EligibleWaitlistEntry = {
  email: string;
  name: string | null;
  position: number;
  referral: string | null;
};

type PullFromWaitlistAuditContext = {
  actor: string;
  metadata?: Record<string, unknown>;
};

function getErrorMessage(error: unknown): string {
  // Walk the cause chain: when a Postgres function raises, Drizzle's top-level
  // message is just "Failed query: ..." and the real PG message (e.g. the
  // leave_waitlist "not_found" text) lives on error.cause.
  const parts: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join(" ");
}

function normalizeReferralCode(
  referralCode: string | null | undefined,
): string | null {
  const normalized = referralCode?.trim().toLowerCase() || null;
  return normalized || null;
}

async function sanitizePromotionReferral(args: {
  eventId: string;
  referralCode: string | null;
  referralsEnabled: boolean;
  userEmail: string;
}): Promise<string | null> {
  const { eventId, referralCode, referralsEnabled, userEmail } = args;
  const normalizedReferral = normalizeReferralCode(referralCode);

  if (!normalizedReferral || !referralsEnabled) {
    return null;
  }

  const userReferralCode = normalizeReferralCode(
    userEmail.split("@")[0] ?? null,
  );
  if (normalizedReferral === userReferralCode) {
    return null;
  }

  const referralRecord = await db.query.referrals.findFirst({
    where: and(
      eq(referrals.eventId, eventId),
      eq(referrals.referralCode, normalizedReferral),
    ),
    columns: { id: true },
  });

  return referralRecord ? normalizedReferral : null;
}

export async function removeWaitlistEntryForEmail(
  eventId: string,
  email: string,
): Promise<boolean> {
  try {
    await db.execute(sql`
      SELECT leave_waitlist(${eventId}::uuid, ${email})
    `);
    return true;
  } catch (error: unknown) {
    const message = getErrorMessage(error).toLowerCase();
    if (message.includes("not_found")) {
      return false;
    }

    throw error;
  }
}

async function getEligibleWaitlistEntries(
  eventId: string,
  maxToPull: number,
): Promise<EligibleWaitlistEntry[]> {
  const eligibleEntries: EligibleWaitlistEntry[] = [];
  const batchSize = Math.max(maxToPull * WAITLIST_BATCH_MULTIPLIER, MIN_WAITLIST_BATCH_SIZE);
  let lastSeenPosition: number | null = null;

  while (eligibleEntries.length < maxToPull) {
    const waitlistBatch: EligibleWaitlistEntry[] = await db.query.waitlist.findMany({
      where: lastSeenPosition === null
        ? eq(waitlist.eventId, eventId)
        : and(eq(waitlist.eventId, eventId), gt(waitlist.position, lastSeenPosition)),
      orderBy: (t, { asc }) => [asc(t.position)],
      limit: batchSize,
      columns: {
        email: true,
        name: true,
        position: true,
        referral: true,
      },
    });

    if (!waitlistBatch.length) {
      break;
    }

    const batchEmails = waitlistBatch.map((entry) => entry.email);
    const [feeWaiverEmails, existingTickets] = await Promise.all([
      getFeeWaiverEmailSetForEmails(batchEmails),
      db.query.tickets.findMany({
        where: and(
          eq(tickets.eventId, eventId),
          inArray(tickets.email, batchEmails),
        ),
        columns: { email: true },
      }),
    ]);

    const existingTicketEmails = new Set(
      existingTickets.map((ticket) => normalizeEmail(ticket.email)),
    );

    for (const entry of waitlistBatch) {
      const normalizedEmail = normalizeEmail(entry.email);

      if (
        feeWaiverEmails.has(normalizedEmail)
        || existingTicketEmails.has(normalizedEmail)
      ) {
        continue;
      }

      eligibleEntries.push(entry);

      if (eligibleEntries.length >= maxToPull) {
        break;
      }
    }

    lastSeenPosition = waitlistBatch[waitlistBatch.length - 1]?.position ?? null;
    if (waitlistBatch.length < batchSize) {
      break;
    }
  }

  return eligibleEntries;
}

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

export async function pullFromWaitlist(
  _adminClient: unknown, // kept for backward compatibility during migration
  eventId: string,
  limit?: number,
  auditContext?: PullFromWaitlistAuditContext,
): Promise<number> {
  const ticketInfo = await getAvailablePublicTickets(eventId);
  const maxAvailable = ticketInfo.available;
  const maxToPull =
    typeof limit === "number" ? Math.min(limit, maxAvailable) : maxAvailable;

  if (maxToPull <= 0) return 0;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { referralsEnabled: true },
  });

  if (!event) {
    return 0;
  }

  const eligibleWaitlistEntries = await getEligibleWaitlistEntries(
    eventId,
    maxToPull,
  );

  if (!eligibleWaitlistEntries.length) return 0;

  let promotedCount = 0;

  for (const entry of eligibleWaitlistEntries) {
    const sanitizedReferral = await sanitizePromotionReferral({
      eventId,
      referralCode: entry.referral,
      referralsEnabled: event.referralsEnabled ?? false,
      userEmail: entry.email,
    });

    try {
      const [inserted] = await db.insert(tickets).values({
        eventId,
        email: entry.email,
        name: entry.name ?? null,
        type: "STANDARD",
        referral: sanitizedReferral,
      }).onConflictDoNothing({
        target: [tickets.eventId, tickets.email],
      }).returning({ id: tickets.id });

      if (!inserted) {
        try {
          await removeWaitlistEntryForEmail(eventId, entry.email);
        } catch (waitlistError) {
          console.error("Waitlist cleanup after duplicate ticket failed:", waitlistError);
        }
        continue;
      }

      const newTicket = await db.query.tickets.findFirst({
        where: eq(tickets.id, inserted.id),
        columns: { id: true, email: true, name: true, type: true, eventId: true },
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
              tagline: true,
              imgVersion: true,
            },
          },
        },
      });

      try {
        await removeWaitlistEntryForEmail(eventId, entry.email);
      } catch (waitlistError) {
        console.error("Waitlist removal error after promotion (non-fatal):", waitlistError);
      }

      if (!newTicket) {
        continue;
      }

      promotedCount++;

      if (auditContext) {
        await logAuditEvent({
          action: "waitlist.pull",
          actor: auditContext.actor,
          eventId,
          eventName: newTicket.event?.name ?? null,
          targetEmail: newTicket.email,
          metadata: {
            ticketId: newTicket.id,
            ticketType: newTicket.type ?? "STANDARD",
            waitlistPosition: entry.position,
            ...(auditContext.metadata ?? {}),
          },
        });
      }

      try {
        await sendWithRetry(() =>
          sendTicketEmail({
            email: newTicket.email,
            name: newTicket.name || null,
            eventName: newTicket.event?.name || "Event",
            ticketType: newTicket.type || "STANDARD",
            eventStartTime: newTicket.event?.startTimeDate?.toISOString() || null,
            eventEndTime: newTicket.event?.endTimeDate?.toISOString() || null,
            eventRoute: newTicket.event?.route || null,
            ticketId: newTicket.id,
            eventVenue: newTicket.event?.venue || null,
            eventVenueLink: newTicket.event?.venueLink || null,
            eventDescription: newTicket.event?.desc || null,
            doorsOpenTime: newTicket.event?.doorsOpen?.toISOString() || null,
            eventId: newTicket.event?.id || null,
            imgVersion: newTicket.event?.imgVersion ?? null,
            eventTagline: newTicket.event?.tagline || null,
          })
        );
      } catch (emailError) {
        console.error(
          "Email sending error for waitlist conversion (non-fatal):",
          emailError,
        );
      }
    } catch (err) {
      console.error(
        "Failed to create ticket for waitlist person (non-fatal):",
        err,
      );
    }
  }

  return promotedCount;
}
