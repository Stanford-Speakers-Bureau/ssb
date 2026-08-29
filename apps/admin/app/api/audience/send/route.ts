import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { isValidUUID } from "@/app/lib/validation";
import { sendEventAnnouncedEmail } from "@/app/lib/email";
import { db, eq, events } from "@ssb/db";
import { filterUnsubscribedHierarchical } from "@/app/lib/mailing-list";
import { logAuditEvent } from "@/app/lib/audit";
import {
  logSendFailures,
  partitionBySuppression,
} from "@/app/lib/email-suppression";

export async function POST(req: Request) {
  try {
    let body: { eventId?: string; emails?: string[] };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { eventId, emails } = body;

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

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "emails must be a non-empty array" },
        { status: 400 },
      );
    }

    if (emails.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 emails per request" },
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

    const eventName = event.name || "Event";
    const eventRoute = event.route ?? null;
    const eventStartTime = event.startTimeDate?.toISOString() ?? null;
    const ticketingOpen = event.ticketingDate
      ? new Date() >= new Date(event.ticketingDate)
      : false;

    const { kept: filteredEmails, skipped: optedOut } =
      await filterUnsubscribedHierarchical(emails, eventId);

    const { sendable, suppressed } = await partitionBySuppression(filteredEmails);
    const batchId = randomUUID();

    if (sendable.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        skippedOptedOut: optedOut.length,
        suppressed: suppressed.length,
        batchId,
      });
    }

    // Each request is capped at 50 recipients, well within SES quota of 100/s.
    const results = await Promise.allSettled(
      sendable.map((email) =>
        sendEventAnnouncedEmail({
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
        }),
      ),
    );

    let sent = 0;
    let failed = 0;
    const sentEmails: string[] = [];
    const failures: Array<{ email: string; error: unknown }> = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        sent++;
        sentEmails.push(sendable[i]);
      } else {
        failed++;
        failures.push({ email: sendable[i], error: result.reason });
        console.error(
          `Failed to send announcement to ${sendable[i]}:`,
          result.reason,
        );
      }
    }

    await logSendFailures({
      failures,
      actor: auth.email!,
      source: "audience_send",
      batchId,
      eventId,
      eventName: event.name ?? null,
    });

    await logAuditEvent({
      action: "email.send_mass",
      actor: auth.email!,
      eventId,
      eventName: event.name ?? null,
      metadata: {
        type: "audienceSend",
        sent,
        failed,
        skipped: optedOut.length,
        skippedOptedOut: optedOut.length,
        suppressed: suppressed.length,
        total: sent + failed + optedOut.length + suppressed.length,
        batchId,
        recipients: sentEmails,
      },
    });

    return NextResponse.json({
      sent,
      failed,
      skippedOptedOut: optedOut.length,
      suppressed: suppressed.length,
      batchId,
    });
  } catch (err) {
    console.error("Audience send error:", err);
    return NextResponse.json(
      { error: "Failed to send announcement emails" },
      { status: 500 },
    );
  }
}
