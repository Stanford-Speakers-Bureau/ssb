import { NextResponse } from "next/server";
import { requireCampaignSendPermission } from "@/app/lib/campaignPermissions";
import {
  and,
  db,
  eq,
  emailCampaigns,
  events,
  sql,
  tickets,
} from "@ssb/db";
import {
  REMINDER_EMAIL_BATCH_SIZE,
  REMINDER_EMAIL_MIN_BATCH_DURATION_MS,
} from "@/app/lib/constants";
import { buildEventFeedbackLink } from "@/app/lib/feedback-links";
import { buildCancellationLink } from "@/app/lib/cancellation-links";
import {
  canonicalizeEmail,
  isValidEmail,
  isValidUUID,
  normalizeEmail,
} from "@/app/lib/validation";
import { sendCampaignEmail } from "@/app/lib/email";
import { logAuditEvent } from "@/app/lib/audit";
import { parseAudiences, resolveSegments } from "@/app/lib/campaignAudience";
import {
  filterForNewsletter,
  filterUnsubscribed,
  filterUnsubscribedHierarchical,
} from "@/app/lib/mailing-list";
import {
  logSendFailures,
  partitionBySuppression,
} from "@/app/lib/email-suppression";

const MAX_EMAILS_PER_REQUEST = REMINDER_EMAIL_BATCH_SIZE;

type Params = { params: Promise<{ id: string }> };

// Match tickets by the *canonical* email so gmail dot/+suffix variants line up
// with the canonicalized audience list. Raw `lower(trim())` matching would drop
// ticket holders whose ticket email differs only by gmail dots/+suffix from the
// canonicalized recipient (Stanford is intentionally excluded by canonicalize_email).
function canonicalTicketEmailIn(emails: string[]) {
  const canonicalEmails = emails.map((email) => canonicalizeEmail(email)).filter(Boolean);

  if (canonicalEmails.length === 0) {
    return sql<boolean>`false`;
  }

  return sql<boolean>`public.canonicalize_email(${tickets.email}) in (${
    sql.join(canonicalEmails.map((email) => sql`${email}`), sql`, `)
  })`;
}

export async function POST(req: Request, { params }: Params) {
  try {
    const batchStartTime = Date.now();
    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
    }

    let body: {
      emails?: string[];
      auditBatchId?: string;
      chunkIndex?: number;
      chunkCount?: number;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { emails: rawEmails, auditBatchId, chunkIndex, chunkCount } = body;

    if (!Array.isArray(rawEmails) || rawEmails.length === 0) {
      return NextResponse.json(
        { error: "emails must be a non-empty array" },
        { status: 400 },
      );
    }

    const normalizedAuditBatchId =
      typeof auditBatchId === "string" && auditBatchId.trim().length > 0
        ? auditBatchId.trim()
        : null;
    if (!normalizedAuditBatchId) {
      return NextResponse.json(
        { error: "auditBatchId is required" },
        { status: 400 },
      );
    }

    if (
      typeof chunkIndex !== "number" ||
      !Number.isInteger(chunkIndex) ||
      chunkIndex < 0 ||
      typeof chunkCount !== "number" ||
      !Number.isInteger(chunkCount) ||
      chunkCount <= 0 ||
      chunkIndex >= chunkCount
    ) {
      return NextResponse.json(
        { error: "chunkIndex and chunkCount must be valid integers" },
        { status: 400 },
      );
    }

    const emails = [...new Set(
      rawEmails
        .filter((email): email is string => typeof email === "string")
        .map((email) => normalizeEmail(email))
        .filter((email) => email.length > 0),
    )];

    if (emails.length === 0) {
      return NextResponse.json(
        { error: "emails must contain at least one valid address" },
        { status: 400 },
      );
    }

    const invalidEmails = emails.filter((email) => !isValidEmail(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: "emails must all be valid email addresses" },
        { status: 400 },
      );
    }

    if (emails.length > MAX_EMAILS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_EMAILS_PER_REQUEST} emails per request` },
        { status: 400 },
      );
    }

    const campaign = await db.query.emailCampaigns.findFirst({
      where: eq(emailCampaigns.id, id),
      with: {
        event: {
          columns: {
            name: true,
            route: true,
            startTimeDate: true,
            tagline: true,
            imgVersion: true,
            venue: true,
            venueLink: true,
            doorsOpen: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const auth = await requireCampaignSendPermission({
      audiences: parseAudiences(campaign.audiences),
      eventId: campaign.eventId,
      includeHeroCard: campaign.includeHeroCard,
      feedbackEventId: campaign.feedbackEventId,
      includeFeedbackPrompt: campaign.includeFeedbackPrompt,
    });
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    if (campaign.status === "sent") {
      return NextResponse.json(
        { error: "Campaign has already been sent" },
        { status: 400 },
      );
    }

    if (campaign.status === "partial") {
      return NextResponse.json(
        { error: "Campaign completed with failures and cannot be resent safely" },
        { status: 400 },
      );
    }

    let activeCampaign = campaign;

    if (campaign.status === "draft") {
      const [claimedCampaign] = await db
        .update(emailCampaigns)
        .set({
          status: "sending",
          sendBatchId: normalizedAuditBatchId,
          sentBy: auth.email!,
          sentAt: null,
          recipientCount: 0,
          failedCount: 0,
          lastProcessedChunkIndex: -1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(emailCampaigns.id, id),
            eq(emailCampaigns.status, "draft"),
          ),
        )
        .returning();

      if (!claimedCampaign) {
        const latestCampaign = await db.query.emailCampaigns.findFirst({
          where: eq(emailCampaigns.id, id),
          with: {
            event: {
              columns: {
                name: true,
                route: true,
                startTimeDate: true,
                tagline: true,
                imgVersion: true,
                venue: true,
                venueLink: true,
                doorsOpen: true,
              },
            },
          },
        });

        if (!latestCampaign) {
          return NextResponse.json(
            { error: "Campaign not found" },
            { status: 404 },
          );
        }

        activeCampaign = latestCampaign;
      } else {
        activeCampaign = {
          ...campaign,
          status: claimedCampaign.status,
          sendBatchId: claimedCampaign.sendBatchId,
          sentBy: claimedCampaign.sentBy,
          sentAt: claimedCampaign.sentAt,
          recipientCount: claimedCampaign.recipientCount,
          failedCount: claimedCampaign.failedCount,
        };
      }
    }

    if (activeCampaign.status !== "sending") {
      return NextResponse.json(
        { error: `Cannot send campaign while status is ${activeCampaign.status}` },
        { status: 400 },
      );
    }

    if (activeCampaign.sendBatchId !== normalizedAuditBatchId) {
      return NextResponse.json(
        { error: "Campaign is already being sent from another session" },
        { status: 409 },
      );
    }

    const expectedChunkIndex = (activeCampaign.lastProcessedChunkIndex ?? -1) + 1;
    if (chunkIndex !== expectedChunkIndex) {
      return NextResponse.json(
        {
          error:
            chunkIndex <= (activeCampaign.lastProcessedChunkIndex ?? -1)
              ? "This send chunk was already processed"
              : "Send chunks must be processed in order",
        },
        { status: 409 },
      );
    }

    const allowedEmails = await resolveSegments(
      parseAudiences(activeCampaign.audiences),
    );
    const allowedEmailSet = new Set(allowedEmails);
    const unauthorizedEmails = emails.filter((email) => !allowedEmailSet.has(email));
    if (unauthorizedEmails.length > 0) {
      return NextResponse.json(
        { error: "One or more emails are not part of the campaign audience" },
        { status: 400 },
      );
    }

    // The campaign's footer_type drives both the rendered footer and whether
    // the unsubscribe filter runs at all:
    //   - "essential" / "none": treat as transactional — no filter (admin chose
    //     to bypass opt-outs, e.g. for ticket-holder service mail).
    //   - "event_unsubscribe" with an eventId: hierarchical filter.
    //   - "event_unsubscribe" without an eventId: behave like announce (fallback).
    //   - "announce_unsubscribe": announce-only filter.
    //   - "newsletter_unsubscribe": exclude announce + newsletter opt-outs.
    const footerType = activeCampaign.footerType;
    const filterMode: "hierarchical" | "announce" | "newsletter" | "skip" =
      footerType === "essential" || footerType === "none"
        ? "skip"
        : footerType === "newsletter_unsubscribe"
          ? "newsletter"
          : footerType === "event_unsubscribe" && activeCampaign.eventId
            ? "hierarchical"
            : "announce";

    const { kept: filteredEmails, skipped: unsubSkipped } =
      filterMode === "skip"
        ? { kept: emails, skipped: [] as string[] }
        : filterMode === "hierarchical"
          ? await filterUnsubscribedHierarchical(emails, activeCampaign.eventId!)
          : filterMode === "newsletter"
            ? await filterForNewsletter(emails)
            : await filterUnsubscribed(emails, "announce", null);

    // Drop hard-suppressed addresses up front so they don't count as "sent"
    // and so we can report a suppression count.
    const { sendable: sendableEmails, suppressed: suppressedEmails } =
      await partitionBySuppression(filteredEmails);
    const skippedCount = unsubSkipped.length;
    const suppressedCount = suppressedEmails.length;

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
    const feedbackEvent = activeCampaign.includeFeedbackPrompt
      && activeCampaign.feedbackEventId
      ? await db.query.events.findFirst({
          where: eq(events.id, activeCampaign.feedbackEventId),
          columns: {
            id: true,
            name: true,
            route: true,
            startTimeDate: true,
            endTimeDate: true,
          },
        })
      : null;

    const feedbackTicketRows = feedbackEvent
      ? await db.query.tickets.findMany({
          where: and(
            eq(tickets.eventId, feedbackEvent.id),
            eq(tickets.scanned, true),
            canonicalTicketEmailIn(sendableEmails),
          ),
          columns: {
            id: true,
            email: true,
          },
        })
      : [];
    const feedbackTicketByEmail = new Map(
      feedbackTicketRows.map((ticket) => [canonicalizeEmail(ticket.email), ticket]),
    );

    // Cancel callout: the same signed cancel-ticket link used in transactional
    // emails. Only recipients who hold a ticket to the chosen event get it, so
    // the link is built per recipient from their ticket.
    const cancelCalloutEvent = activeCampaign.includeCancelCallout
      && activeCampaign.cancelCalloutEventId
      ? await db.query.events.findFirst({
          where: eq(events.id, activeCampaign.cancelCalloutEventId),
          columns: {
            id: true,
            startTimeDate: true,
            endTimeDate: true,
          },
        })
      : null;
    const cancelCalloutPosition =
      activeCampaign.cancelCalloutPosition === "after" ? "after" : "before";

    const cancelTicketRows = cancelCalloutEvent
      ? await db.query.tickets.findMany({
          where: and(
            eq(tickets.eventId, cancelCalloutEvent.id),
            canonicalTicketEmailIn(sendableEmails),
          ),
          columns: {
            id: true,
            email: true,
          },
        })
      : [];
    const cancelTicketByEmail = new Map(
      cancelTicketRows.map((ticket) => [canonicalizeEmail(ticket.email), ticket]),
    );

    const results = await Promise.allSettled(
      sendableEmails.map(async (email) => {
        const canonicalEmail = canonicalizeEmail(email);
        const feedbackTicket = feedbackEvent
          ? feedbackTicketByEmail.get(canonicalEmail)
          : null;
        const cancelTicket = cancelCalloutEvent
          ? cancelTicketByEmail.get(canonicalEmail)
          : null;
        const cancelCallout = cancelCalloutEvent && cancelTicket
          ? {
              url: await buildCancellationLink({
                baseUrl,
                email,
                ticketId: cancelTicket.id,
                eventStartTime:
                  cancelCalloutEvent.startTimeDate?.toISOString() ?? null,
                eventEndTime:
                  cancelCalloutEvent.endTimeDate?.toISOString() ?? null,
              }),
              position: cancelCalloutPosition as "before" | "after",
              text: activeCampaign.cancelCalloutText,
            }
          : null;
        const feedbackPrompt = feedbackEvent && feedbackTicket
          ? {
              eventName: feedbackEvent.name || "this event",
              formUrl: await buildEventFeedbackLink({
                baseUrl,
                eventRoute: feedbackEvent.route || feedbackEvent.id,
                email,
                ticketId: feedbackTicket.id,
                eventId: feedbackEvent.id,
                eventStartTime:
                  feedbackEvent.startTimeDate?.toISOString() ?? null,
                eventEndTime: feedbackEvent.endTimeDate?.toISOString() ?? null,
              }),
              scoreLinks: await Promise.all(
                Array.from({ length: 10 }, (_, index) =>
                  buildEventFeedbackLink({
                    baseUrl,
                    eventRoute: feedbackEvent.route || feedbackEvent.id,
                    email,
                    ticketId: feedbackTicket.id,
                    eventId: feedbackEvent.id,
                    score: index + 1,
                    eventStartTime:
                      feedbackEvent.startTimeDate?.toISOString() ?? null,
                    eventEndTime:
                      feedbackEvent.endTimeDate?.toISOString() ?? null,
                  }).then((url) => ({ score: index + 1, url })),
                ),
              ),
            }
          : null;

        return sendCampaignEmail({
          email,
          subject: activeCampaign.subject,
          bodyMarkdown: activeCampaign.body,
          includeHeroCard: activeCampaign.includeHeroCard,
          footerType: activeCampaign.footerType as
            | "event_unsubscribe"
            | "announce_unsubscribe"
            | "newsletter_unsubscribe"
            | "essential"
            | "none",
          eventName: activeCampaign.event?.name ?? null,
          eventTagline: activeCampaign.event?.tagline ?? null,
          eventStartTime: activeCampaign.event?.startTimeDate?.toISOString() ?? null,
          doorsOpenTime: activeCampaign.event?.doorsOpen?.toISOString() ?? null,
          eventVenue: activeCampaign.event?.venue ?? null,
          eventVenueLink: activeCampaign.event?.venueLink ?? null,
          eventId: activeCampaign.eventId ?? null,
          imgVersion: activeCampaign.event?.imgVersion ?? null,
          feedbackPrompt,
          cancelCallout,
        });
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
        sentEmails.push(sendableEmails[i]);
      } else {
        failed++;
        failures.push({ email: sendableEmails[i], error: result.reason });
        console.error(
          `Campaign email send failed for ${sendableEmails[i]}:`,
          result.reason,
        );
      }
    }

    await logSendFailures({
      failures,
      actor: auth.email!,
      source: "campaign",
      batchId: normalizedAuditBatchId,
      eventId: activeCampaign.eventId ?? null,
      eventName: activeCampaign.event?.name ?? null,
      extraMetadata: { campaignId: id, chunkIndex },
    });

    const isFinalChunk = chunkIndex === chunkCount - 1;

    const [updatedCampaign] = await db
      .update(emailCampaigns)
      .set({
        recipientCount: sql`coalesce(${emailCampaigns.recipientCount}, 0) + ${sent}`,
        failedCount: sql`coalesce(${emailCampaigns.failedCount}, 0) + ${failed}`,
        lastProcessedChunkIndex: chunkIndex,
        status: isFinalChunk
          ? sql`case when coalesce(${emailCampaigns.failedCount}, 0) + ${failed} > 0 then 'partial' else 'sent' end`
          : "sending",
        sentAt: isFinalChunk ? new Date() : sql`${emailCampaigns.sentAt}`,
        sendBatchId: isFinalChunk ? null : normalizedAuditBatchId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailCampaigns.id, id),
          eq(emailCampaigns.sendBatchId, normalizedAuditBatchId),
          eq(emailCampaigns.lastProcessedChunkIndex, chunkIndex - 1),
        ),
      )
      .returning({
        status: emailCampaigns.status,
        recipientCount: emailCampaigns.recipientCount,
        failedCount: emailCampaigns.failedCount,
        lastProcessedChunkIndex: emailCampaigns.lastProcessedChunkIndex,
      });

    if (!updatedCampaign) {
      return NextResponse.json(
        { error: "Campaign send state changed while processing this batch" },
        { status: 409 },
      );
    }

    await logAuditEvent({
      action: "campaign.send",
      actor: auth.email!,
      metadata: {
        campaignId: id,
        subject: activeCampaign.subject,
        sent,
        failed,
        skipped: skippedCount,
        skippedOptedOut: skippedCount,
        suppressed: suppressedCount,
        footerType,
        filterMode,
        batchId: normalizedAuditBatchId,
        // The actual recipients delivered in this chunk. The audit view merges
        // these across a batch's chunks into one recipient list.
        recipients: sentEmails,
      },
    });

    const batchDuration = Date.now() - batchStartTime;
    if (
      batchDuration < REMINDER_EMAIL_MIN_BATCH_DURATION_MS &&
      !isFinalChunk
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, REMINDER_EMAIL_MIN_BATCH_DURATION_MS - batchDuration),
      );
    }

    return NextResponse.json({
      sent,
      failed,
      // Campaign skips are mailing-list opt-outs (no ticket filter here).
      skippedOptedOut: skippedCount,
      suppressed: suppressedCount,
      status: updatedCampaign.status,
      recipientCount: updatedCampaign.recipientCount,
      failedCount: updatedCampaign.failedCount,
    });
  } catch (err) {
    console.error("Campaign send error:", err);
    return NextResponse.json(
      { error: "Failed to send campaign emails" },
      { status: 500 },
    );
  }
}
