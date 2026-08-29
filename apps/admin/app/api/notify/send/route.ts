import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import {
  REMINDER_EMAIL_BATCH_SIZE,
  REMINDER_EMAIL_MIN_BATCH_DURATION_MS,
} from "@/app/lib/constants";
import { isValidUUID } from "@/app/lib/validation";
import {
  sendTicketsAvailableNowEmail,
  sendTicketsAvailableInEmail,
  sendClaimTicketEmail,
} from "@/app/lib/email";
import { db, eq, notify, events, tickets } from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";

export async function POST(req: Request) {
  try {
    let body: {
      eventId?: string;
      variant?: "now" | "in" | "claim";
      approxTimeUntilAvailable?: string;
      singleEmail?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { eventId, variant, approxTimeUntilAvailable, singleEmail } = body;

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
    if (!variant || (variant !== "now" && variant !== "in" && variant !== "claim")) {
      return NextResponse.json(
        { error: 'variant must be "now", "in", or "claim"' },
        { status: 400 },
      );
    }
    if (variant === "in") {
      const approx =
        typeof approxTimeUntilAvailable === "string"
          ? approxTimeUntilAvailable.trim()
          : "";
      if (!approx) {
        return NextResponse.json(
          { error: "approxTimeUntilAvailable is required when variant is 'in'" },
          { status: 400 },
        );
      }
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

    const notifications = await db.query.notify.findMany({
      where: eq(notify.speakerId, eventId),
      columns: { email: true },
    });

    const allNotifyEmails = new Set(
      notifications.map((n) => n.email.toLowerCase()),
    );

    let emails: string[];
    if (singleEmail && typeof singleEmail === "string") {
      const email = singleEmail.trim().toLowerCase();
      if (!email) {
        return NextResponse.json(
          { error: "singleEmail must be a non-empty string" },
          { status: 400 },
        );
      }
      if (!allNotifyEmails.has(email)) {
        return NextResponse.json(
          { error: "Email not in notification list for this event" },
          { status: 400 },
        );
      }
      emails = [email];
    } else {
      emails = [...allNotifyEmails];
    }

    // For "claim" variant, filter out emails that already have tickets
    let skipped = 0;
    if (variant === "claim") {
      const ticketResults = await db.query.tickets.findMany({
        where: eq(tickets.eventId, eventId),
        columns: { email: true },
      });
      const ticketEmailSet = new Set(
        ticketResults.map((t) => t.email.toLowerCase()),
      );
      const originalCount = emails.length;
      emails = emails.filter((e) => !ticketEmailSet.has(e));
      skipped = originalCount - emails.length;
    }

    if (emails.length === 0) {
      return NextResponse.json(
        { error: "No recipients to send to", sent: 0, failed: 0, skipped },
        { status: 200 },
      );
    }

    // Send emails in batches to avoid memory overflow.
    // We reuse the reminder pacing constants to keep admin email bursts consistent.
    const BATCH_SIZE = REMINDER_EMAIL_BATCH_SIZE;
    const MIN_BATCH_DURATION_MS = REMINDER_EMAIL_MIN_BATCH_DURATION_MS;
    const results: PromiseSettledResult<{
      success: boolean;
      email: string;
      error?: unknown;
    }>[] = [];

    const approxTime = variant === "in" ? approxTimeUntilAvailable!.trim() : "";

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batchStartTime = Date.now();
      const batch = emails.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map((email) =>
        (variant === "now"
          ? sendTicketsAvailableNowEmail({
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
            })
          : variant === "claim"
          ? sendClaimTicketEmail({
              email,
              eventName,
              eventRoute,
              eventStartTime,
              eventId: event.id,
              imgVersion: event.imgVersion,
              eventTagline: event.tagline || null,
              doorsOpenTime: event.doorsOpen?.toISOString() || null,
            })
          : sendTicketsAvailableInEmail({
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
            })
        ).then(
          () => ({ success: true, email }),
          (error) => ({ success: false, email, error }),
        ),
      );
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Rate limiting: ensure we don't exceed 14 emails/second
      const batchDuration = Date.now() - batchStartTime;
      if (batchDuration < MIN_BATCH_DURATION_MS && i + BATCH_SIZE < emails.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_BATCH_DURATION_MS - batchDuration),
        );
      }
    }

    let sent = 0;
    let failed = 0;
    const sentEmails: string[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.success) {
          sent++;
          sentEmails.push(result.value.email);
        } else {
          failed++;
          console.error(`Failed to send notify email to ${result.value.email}:`, result.value.error);
        }
      } else {
        failed++;
      }
    }

    await logAuditEvent({
      action: "email.send_mass",
      actor: auth.email!,
      eventId: eventId,
      eventName: event.name ?? null,
      metadata: { type: "notifySend", variant, sent, failed, skipped, recipients: sentEmails },
    });

    return NextResponse.json({ sent, failed, skipped });
  } catch (err) {
    console.error("Notify send error:", err);
    return NextResponse.json(
      { error: "Failed to send notify emails" },
      { status: 500 },
    );
  }
}
