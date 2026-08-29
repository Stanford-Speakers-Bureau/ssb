import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import {
  sendClaimTicketEmail,
  sendEventAnnouncedEmail,
  sendTicketsAvailableInEmail,
  sendTicketsAvailableNowEmail,
} from "@/app/lib/email";
import { isValidUUID } from "@/app/lib/validation";
import { db, eq, events, notify, tickets } from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";
import { filterUnsubscribedHierarchical } from "@/app/lib/mailing-list";
import {
  logSendFailures,
  partitionBySuppression,
} from "@/app/lib/email-suppression";

const MAX_EMAILS_PER_REQUEST = 50;

type BulkEmailKind =
  | "announcement"
  | "ticketsAvailableNow"
  | "ticketsAvailableIn"
  | "claimTicket";

type BulkSendRequest = {
  eventId?: string;
  emails?: string[];
  kind?: BulkEmailKind;
  approxTimeUntilAvailable?: string;
  auditBatchId?: string;
};

function normalizeEmails(emails: string[]): string[] {
  return [...new Set(
    emails
      .filter((email): email is string => typeof email === "string")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )];
}

export async function POST(req: Request) {
  try {
    let body: BulkSendRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      eventId,
      emails: rawEmails,
      kind,
      approxTimeUntilAvailable,
      auditBatchId,
    } = body;

    if (!eventId || typeof eventId !== "string" || !isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "eventId is required and must be a valid UUID" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("campaigns.send", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    if (!Array.isArray(rawEmails) || rawEmails.length === 0) {
      return NextResponse.json(
        { error: "emails must be a non-empty array" },
        { status: 400 },
      );
    }

    const emails = normalizeEmails(rawEmails);
    if (emails.length === 0) {
      return NextResponse.json(
        { error: "emails must contain at least one valid address" },
        { status: 400 },
      );
    }

    if (emails.length > MAX_EMAILS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_EMAILS_PER_REQUEST} emails per request` },
        { status: 400 },
      );
    }

    if (
      kind !== "announcement" &&
      kind !== "ticketsAvailableNow" &&
      kind !== "ticketsAvailableIn" &&
      kind !== "claimTicket"
    ) {
      return NextResponse.json(
        {
          error:
            'kind must be "announcement", "ticketsAvailableNow", "ticketsAvailableIn", or "claimTicket"',
        },
        { status: 400 },
      );
    }

    const approxTime = typeof approxTimeUntilAvailable === "string"
      ? approxTimeUntilAvailable.trim()
      : "";
    const normalizedAuditBatchId =
      typeof auditBatchId === "string" && auditBatchId.trim().length > 0
        ? auditBatchId.trim()
        : null;
    if (kind === "ticketsAvailableIn" && !approxTime) {
      return NextResponse.json(
        {
          error:
            "approxTimeUntilAvailable is required when kind is 'ticketsAvailableIn'",
        },
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
        ticketingDate: true,
        releaseDate: true,
        tagline: true,
        imgVersion: true,
        desc: true,
        venue: true,
        venueLink: true,
        doorsOpen: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    let recipients = emails;
    let skippedHasTicket = 0;
    let skippedOptedOut = 0;

    if (kind !== "announcement") {
      const notifications = await db.query.notify.findMany({
        where: eq(notify.speakerId, eventId),
        columns: { email: true },
      });
      const notifyEmails = new Set(
        notifications.map((entry) => entry.email.trim().toLowerCase()),
      );
      const invalidEmails = recipients.filter((email) => !notifyEmails.has(email));

      if (invalidEmails.length > 0) {
        return NextResponse.json(
          { error: "One or more emails are not on the notification list" },
          { status: 400 },
        );
      }

      if (kind === "claimTicket") {
        const ticketResults = await db.query.tickets.findMany({
          where: eq(tickets.eventId, eventId),
          columns: { email: true },
        });
        const ticketEmailSet = new Set(
          ticketResults.map((ticket) => ticket.email.trim().toLowerCase()),
        );
        const originalCount = recipients.length;
        recipients = recipients.filter((email) => !ticketEmailSet.has(email));
        skippedHasTicket = originalCount - recipients.length;
      }
    }

    const { kept, skipped: unsubSkipped } = await filterUnsubscribedHierarchical(
      recipients,
      eventId,
    );
    skippedOptedOut = unsubSkipped.length;
    recipients = kept;

    const { sendable, suppressed: suppressedList } =
      await partitionBySuppression(recipients);
    recipients = sendable;
    const suppressedCount = suppressedList.length;

    if (recipients.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        skippedHasTicket,
        skippedOptedOut,
        suppressed: suppressedCount,
      });
    }

    const eventName = event.name || "Event";
    const eventRoute = event.route ?? null;
    const eventStartTime = event.startTimeDate?.toISOString() ?? null;
    const ticketingOpen = event.ticketingDate
      ? new Date() >= new Date(event.ticketingDate)
      : false;

    const results = await Promise.allSettled(
      recipients.map((email) => {
        if (kind === "announcement") {
          return sendEventAnnouncedEmail({
            email,
            eventName,
            eventRoute,
            eventStartTime,
            eventId: event.id,
            imgVersion: event.imgVersion,
            eventTagline: event.tagline || null,
            eventDescription: event.desc || null,
            eventVenue: event.venue || null,
            eventVenueLink: event.venueLink || null,
            doorsOpenTime: event.doorsOpen?.toISOString() || null,
            ticketingOpen,
          }, { skipSuppressionCheck: true });
        }

        if (kind === "ticketsAvailableNow") {
          return sendTicketsAvailableNowEmail({
            email,
            eventName,
            eventRoute,
            eventStartTime,
            eventId: event.id,
            imgVersion: event.imgVersion,
            eventTagline: event.tagline || null,
            eventVenue: event.venue || null,
            eventVenueLink: event.venueLink || null,
            doorsOpenTime: event.doorsOpen?.toISOString() || null,
          }, { skipSuppressionCheck: true });
        }

        if (kind === "claimTicket") {
          return sendClaimTicketEmail({
            email,
            eventName,
            eventRoute,
            eventStartTime,
            eventId: event.id,
            imgVersion: event.imgVersion,
            eventTagline: event.tagline || null,
            doorsOpenTime: event.doorsOpen?.toISOString() || null,
          }, { skipSuppressionCheck: true });
        }

        return sendTicketsAvailableInEmail({
          email,
          eventName,
          eventRoute,
          eventStartTime,
          approxTimeUntilAvailable: approxTime,
          eventId: event.id,
          imgVersion: event.imgVersion,
          eventTagline: event.tagline || null,
          eventVenue: event.venue || null,
          eventVenueLink: event.venueLink || null,
          doorsOpenTime: event.doorsOpen?.toISOString() || null,
          ticketDropTime: event.ticketingDate?.toISOString() || event.releaseDate?.toISOString() || null,
        }, { skipSuppressionCheck: true });
      }),
    );

    let sent = 0;
    let failed = 0;
    const sentEmails: string[] = [];
    const failures: Array<{ email: string; error: unknown }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        sent++;
        sentEmails.push(recipients[i]);
      } else {
        failed++;
        failures.push({ email: recipients[i], error: result.reason });
        console.error(
          `Bulk email send failed for ${recipients[i]}:`,
          result.reason,
        );
      }
    }

    await logSendFailures({
      failures,
      actor: auth.email!,
      source: `bulk_send.${kind}`,
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
        type: "bulkSend",
        kind,
        sent,
        failed,
        // `skipped` keeps the summed total so existing audit-log rendering
        // still shows a single skip count; the broken-out reasons live
        // alongside it.
        skipped: skippedHasTicket + skippedOptedOut,
        skippedHasTicket,
        skippedOptedOut,
        suppressed: suppressedCount,
        total:
          sent + failed + skippedHasTicket + skippedOptedOut + suppressedCount,
        ...(normalizedAuditBatchId ? { batchId: normalizedAuditBatchId } : {}),
        recipients: sentEmails,
      },
    });

    return NextResponse.json({
      sent,
      failed,
      skippedHasTicket,
      skippedOptedOut,
      suppressed: suppressedCount,
    });
  } catch (err) {
    console.error("Bulk email send error:", err);
    return NextResponse.json(
      { error: "Failed to send bulk emails" },
      { status: 500 },
    );
  }
}
