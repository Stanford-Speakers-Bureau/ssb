import { NextResponse } from "next/server";
import { requireCampaignSendPermission } from "@/app/lib/campaignPermissions";
import { and, db, eq, emailCampaigns, events, sql, tickets } from "@ssb/db";
import { buildEventFeedbackLink } from "@/app/lib/feedback-links";
import { buildCancellationLink } from "@/app/lib/cancellation-links";
import { canonicalizeEmail, isValidUUID } from "@/app/lib/validation";
import { sendCampaignEmail } from "@/app/lib/email";
import { parseAudiences } from "@/app/lib/campaignAudience";

type Params = { params: Promise<{ id: string }> };

// Match by canonical email so gmail dot/+suffix variants align with the
// canonicalized audience (mirrors canonicalTicketEmailIn in the send route).
function canonicalTicketEmailEquals(email: string) {
  return sql<boolean>`public.canonicalize_email(${tickets.email}) = ${canonicalizeEmail(email)}`;
}

function buildPreviewFeedbackPrompt(baseUrl: string, eventRoute: string, eventName: string | null) {
  const formUrl = new URL(`/events/${eventRoute}`, baseUrl);
  formUrl.hash = "feedback";

  const scoreLinks = Array.from({ length: 10 }, (_, index) => {
    const score = index + 1;
    const url = new URL(formUrl.toString());
    url.searchParams.set("feedback_score", String(score));
    return { score, url: url.toString() };
  });

  return {
    eventName: eventName || "this event",
    formUrl: formUrl.toString(),
    scoreLinks,
  };
}

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
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

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
    const feedbackEvent = campaign.feedbackEventId
      ? await db.query.events.findFirst({
          where: eq(events.id, campaign.feedbackEventId),
          columns: {
            id: true,
            name: true,
            route: true,
            startTimeDate: true,
            endTimeDate: true,
          },
        })
      : null;
    const feedbackTicket = feedbackEvent
      ? await db.query.tickets.findFirst({
          where: and(
            eq(tickets.eventId, feedbackEvent.id),
            canonicalTicketEmailEquals(auth.email!),
            eq(tickets.scanned, true),
          ),
          columns: {
            id: true,
          },
        })
      : null;

    const feedbackPrompt = campaign.includeFeedbackPrompt && feedbackEvent
      ? feedbackTicket
        ? {
            eventName: feedbackEvent.name || "this event",
            formUrl: await buildEventFeedbackLink({
              baseUrl,
              eventRoute: feedbackEvent.route || feedbackEvent.id,
              email: auth.email!,
              ticketId: feedbackTicket.id,
              eventId: feedbackEvent.id,
              eventStartTime: feedbackEvent.startTimeDate?.toISOString() ?? null,
              eventEndTime: feedbackEvent.endTimeDate?.toISOString() ?? null,
            }),
            scoreLinks: await Promise.all(
              Array.from({ length: 10 }, (_, index) =>
                buildEventFeedbackLink({
                  baseUrl,
                  eventRoute: feedbackEvent.route || feedbackEvent.id,
                  email: auth.email!,
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
        : buildPreviewFeedbackPrompt(
            baseUrl,
            feedbackEvent.route || feedbackEvent.id,
            feedbackEvent.name ?? null,
          )
      : null;

    const cancelCalloutEvent = campaign.cancelCalloutEventId
      ? await db.query.events.findFirst({
          where: eq(events.id, campaign.cancelCalloutEventId),
          columns: {
            id: true,
            startTimeDate: true,
            endTimeDate: true,
          },
        })
      : null;
    const cancelTicket = cancelCalloutEvent
      ? await db.query.tickets.findFirst({
          where: and(
            eq(tickets.eventId, cancelCalloutEvent.id),
            canonicalTicketEmailEquals(auth.email!),
          ),
          columns: {
            id: true,
          },
        })
      : null;
    const cancelCalloutPosition =
      campaign.cancelCalloutPosition === "after" ? "after" : "before";
    const cancelCallout = campaign.includeCancelCallout && cancelCalloutEvent
      ? {
          // Build a real signed link when the tester holds a ticket; otherwise
          // fall back to the cancel landing page so the layout is still
          // previewable.
          url: cancelTicket
            ? await buildCancellationLink({
                baseUrl,
                email: auth.email!,
                ticketId: cancelTicket.id,
                eventStartTime:
                  cancelCalloutEvent.startTimeDate?.toISOString() ?? null,
                eventEndTime:
                  cancelCalloutEvent.endTimeDate?.toISOString() ?? null,
              })
            : new URL("/cancel", baseUrl).toString(),
          position: cancelCalloutPosition as "before" | "after",
          text: campaign.cancelCalloutText,
        }
      : null;

    await sendCampaignEmail({
      email: auth.email!,
      subject: `[TEST] ${campaign.subject}`,
      bodyMarkdown: campaign.body,
      includeHeroCard: campaign.includeHeroCard,
      footerType: campaign.footerType as
        | "event_unsubscribe"
        | "announce_unsubscribe"
        | "newsletter_unsubscribe"
        | "essential"
        | "none",
      eventName: campaign.event?.name ?? null,
      eventTagline: campaign.event?.tagline ?? null,
      eventStartTime: campaign.event?.startTimeDate?.toISOString() ?? null,
      doorsOpenTime: campaign.event?.doorsOpen?.toISOString() ?? null,
      eventVenue: campaign.event?.venue ?? null,
      eventVenueLink: campaign.event?.venueLink ?? null,
      eventId: campaign.eventId ?? null,
      imgVersion: campaign.event?.imgVersion ?? null,
      feedbackPrompt,
      cancelCallout,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Campaign test send error:", err);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 },
    );
  }
}
