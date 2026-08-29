import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { buildEventFeedbackLink } from "@/app/lib/feedback-links";
import { sendCampaignEmail } from "@/app/lib/email";
import { logAuditEvent } from "@/app/lib/audit";
import { isValidUUID, normalizeEmail } from "@/app/lib/validation";
import { REMINDER_EMAIL_BATCH_SIZE } from "@/app/lib/constants";
import {
  and,
  db,
  eq,
  eventFeedback,
  events,
  inArray,
  tickets,
} from "@ssb/db";

const MAX_TICKETS_PER_REQUEST = REMINDER_EMAIL_BATCH_SIZE;

export async function POST(req: Request) {
  try {
    let body: {
      eventId?: unknown;
      ticketIds?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const eventId = typeof body.eventId === "string" ? body.eventId : null;
    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Valid eventId is required" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("campaigns.send", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    if (!Array.isArray(body.ticketIds) || body.ticketIds.length === 0) {
      return NextResponse.json(
        { error: "ticketIds must be a non-empty array" },
        { status: 400 },
      );
    }

    const ticketIds = [
      ...new Set(
        body.ticketIds.filter(
          (id): id is string => typeof id === "string" && isValidUUID(id),
        ),
      ),
    ];

    if (ticketIds.length === 0) {
      return NextResponse.json(
        { error: "ticketIds must contain at least one valid UUID" },
        { status: 400 },
      );
    }

    if (ticketIds.length > MAX_TICKETS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_TICKETS_PER_REQUEST} ticketIds per request` },
        { status: 400 },
      );
    }

    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: {
        id: true,
        name: true,
        route: true,
        tagline: true,
        startTimeDate: true,
        endTimeDate: true,
        doorsOpen: true,
        venue: true,
        venueLink: true,
        imgVersion: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eligibleTickets = await db.query.tickets.findMany({
      where: and(
        eq(tickets.eventId, eventId),
        eq(tickets.scanned, true),
        inArray(tickets.id, ticketIds),
      ),
      columns: {
        id: true,
        email: true,
      },
    });

    if (eligibleTickets.length === 0) {
      return NextResponse.json(
        { sent: 0, failed: 0, skipped: ticketIds.length },
        { status: 200 },
      );
    }

    const existingFeedback = await db.query.eventFeedback.findMany({
      where: and(
        eq(eventFeedback.eventId, eventId),
        inArray(
          eventFeedback.ticketId,
          eligibleTickets.map((t) => t.id),
        ),
      ),
      columns: { ticketId: true },
    });
    const alreadyRecorded = new Set(
      existingFeedback.map((row) => row.ticketId),
    );

    const ticketsToEmail = eligibleTickets.filter(
      (ticket) => !alreadyRecorded.has(ticket.id),
    );
    const skipped = ticketIds.length - ticketsToEmail.length;

    if (ticketsToEmail.length === 0) {
      return NextResponse.json(
        { sent: 0, failed: 0, skipped },
        { status: 200 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
    const eventRoute = event.route || event.id;
    const eventStartIso = event.startTimeDate?.toISOString() ?? null;
    const eventEndIso = event.endTimeDate?.toISOString() ?? null;

    const eventDisplayName = event.name ?? "this event";
    const subject = `How was ${eventDisplayName}?`;
    const bodyMarkdown =
      `Thanks for joining us at **${eventDisplayName}**. Your feedback helps us book the speakers you actually want to see — it only takes one tap.`;

    const results = await Promise.allSettled(
      ticketsToEmail.map(async (ticket) => {
        const normalizedRecipient = normalizeEmail(ticket.email);

        const [formUrl, scoreLinks] = await Promise.all([
          buildEventFeedbackLink({
            baseUrl,
            eventRoute,
            email: normalizedRecipient,
            ticketId: ticket.id,
            eventId: event.id,
            eventStartTime: eventStartIso,
            eventEndTime: eventEndIso,
          }),
          Promise.all(
            Array.from({ length: 10 }, (_, index) =>
              buildEventFeedbackLink({
                baseUrl,
                eventRoute,
                email: normalizedRecipient,
                ticketId: ticket.id,
                eventId: event.id,
                score: index + 1,
                eventStartTime: eventStartIso,
                eventEndTime: eventEndIso,
              }).then((url) => ({ score: index + 1, url })),
            ),
          ),
        ]);

        await sendCampaignEmail({
          email: normalizedRecipient,
          subject,
          bodyMarkdown,
          includeHeroCard: true,
          footerType: "event_unsubscribe",
          eventName: event.name,
          eventTagline: event.tagline ?? null,
          eventStartTime: eventStartIso,
          doorsOpenTime: event.doorsOpen?.toISOString() ?? null,
          eventVenue: event.venue ?? null,
          eventVenueLink: event.venueLink ?? null,
          eventId: event.id,
          imgVersion: event.imgVersion ?? null,
          feedbackPrompt: {
            eventName: eventDisplayName,
            formUrl,
            scoreLinks,
          },
        });
      }),
    );

    let sent = 0;
    let failed = 0;
    const sentEmails: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        sent += 1;
        sentEmails.push(normalizeEmail(ticketsToEmail[i].email));
      } else {
        failed += 1;
        console.error("Feedback prompt send failed:", result.reason);
      }
    }

    await logAuditEvent({
      action: "email.send_mass",
      actor: auth.email!,
      eventId: event.id,
      eventName: event.name,
      metadata: {
        kind: "feedback_prompt",
        requested: ticketIds.length,
        sent,
        failed,
        skipped,
        recipients: sentEmails,
      },
    });

    return NextResponse.json({ sent, failed, skipped }, { status: 200 });
  } catch (error) {
    console.error("Feedback prompt send error:", error);
    return NextResponse.json(
      { error: "Failed to send feedback prompts" },
      { status: 500 },
    );
  }
}
