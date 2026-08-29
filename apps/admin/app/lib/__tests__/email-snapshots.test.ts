import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { mockModule } from "@/tests/helpers/scoped-module-mock";

import {
  captureSesFetch,
  summarizeMime,
} from "../../../tests/helpers/ses-capture";

await mockModule("@ssb/db", () => ({
  db: { query: { roles: { findFirst: async () => null } } },
  eq: () => undefined,
  roles: { email: {} },
}));

const baseTicket = {
  email: "admin-ticket-holder@example.test",
  name: "Admin Test Holder",
  eventName: "Admin Email Snapshot Event",
  eventStartTime: "2030-01-15T19:00:00-08:00",
  eventEndTime: "2030-01-15T21:00:00-08:00",
  eventRoute: "admin-email-snapshot-event",
  ticketId: "00000000-0000-4000-8000-000000000002",
  eventVenue: "Test Auditorium",
  doorsOpenTime: "2030-01-15T18:30:00-08:00",
};

describe("admin ticket email MIME snapshots", () => {
  let capture: ReturnType<typeof captureSesFetch>;

  beforeEach(() => {
    process.env.DISABLE_EMAIL = "";
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.test";
    capture = captureSesFetch();
  });

  afterEach(() => {
    capture.restore();
    process.env.DISABLE_EMAIL = "true";
  });

  test("standard ticket includes QR and calendar MIME parts", async () => {
    const { sendTicketEmail } = await import("../email");
    await sendTicketEmail({ ...baseTicket, ticketType: "STANDARD" });

    expect(capture.messages).toHaveLength(1);
    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].rawMime).toContain("Content-Type: image/png");
    expect(capture.messages[0].rawMime).toContain(
      "Content-Type: text/calendar",
    );
  });

  test("standby ticket omits QR MIME attachment", async () => {
    const { sendTicketEmail } = await import("../email");
    await sendTicketEmail({ ...baseTicket, ticketType: "STANDBY" });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].rawMime).not.toContain(
      "Content-Type: image/png",
    );
  });

  test("day-of reminder includes QR and calendar MIME parts", async () => {
    const { sendDayOfReminderEmail } = await import("../email");
    await sendDayOfReminderEmail({ ...baseTicket, ticketType: "STANDARD" });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].rawMime).toContain("Content-Type: image/png");
    expect(capture.messages[0].rawMime).toContain(
      "Content-Type: text/calendar",
    );
  });

  test("early reminder snapshots promotional copy and attachments", async () => {
    const { sendEarlyReminderEmail } = await import("../email");
    await sendEarlyReminderEmail({
      ...baseTicket,
      ticketType: "STANDARD",
      promo: {
        title: "Front row opportunity",
        description: "Join the pre-event student gathering.",
        day: "Wednesday",
        location: "White Plaza",
        time: "5 PM",
      },
    });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].subject).toContain(baseTicket.eventName);
  });

  test("cancellation and standby-line senders remain attachment-free", async () => {
    const { sendCancellationEmail, sendStandbyLineEmail } =
      await import("../email");
    await sendCancellationEmail({ ...baseTicket, ticketType: "STANDARD" });
    await sendStandbyLineEmail({
      ...baseTicket,
      standbyOpenTime: "6:00 PM",
      expectedCapacity: "25-50",
    });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(summarizeMime(capture.messages[1].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].rawMime).not.toContain(
      "Content-Type: image/png",
    );
    expect(capture.messages[1].rawMime).not.toContain(
      "Content-Type: image/png",
    );
  });

  test("notify-now, notify-soon, and claim senders snapshot", async () => {
    const {
      sendClaimTicketEmail,
      sendTicketsAvailableInEmail,
      sendTicketsAvailableNowEmail,
    } = await import("../email");
    const event = {
      email: baseTicket.email,
      eventName: baseTicket.eventName,
      eventRoute: baseTicket.eventRoute,
      eventStartTime: baseTicket.eventStartTime,
      doorsOpenTime: baseTicket.doorsOpenTime,
    };

    await sendTicketsAvailableNowEmail(event);
    await sendTicketsAvailableInEmail({
      ...event,
      approxTimeUntilAvailable: "2 hours",
      ticketDropTime: "2030-01-15T10:00:00-08:00",
    });
    await sendClaimTicketEmail(event);

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(summarizeMime(capture.messages[1].rawMime)).toMatchSnapshot();
    expect(summarizeMime(capture.messages[2].rawMime)).toMatchSnapshot();
  });

  test("announcement and campaign footer MIME snapshots", async () => {
    const { sendCampaignEmail, sendEventAnnouncedEmail } =
      await import("../email");
    await sendEventAnnouncedEmail({
      email: baseTicket.email,
      eventName: baseTicket.eventName,
      eventRoute: baseTicket.eventRoute,
      eventStartTime: baseTicket.eventStartTime,
      ticketingOpen: false,
    });
    await sendCampaignEmail({
      email: baseTicket.email,
      subject: "Snapshot campaign",
      bodyMarkdown:
        "**Important:** campaign body with [details](https://example.test).",
      includeHeroCard: false,
      footerType: "newsletter_unsubscribe",
    });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(summarizeMime(capture.messages[1].rawMime)).toMatchSnapshot();
    expect(capture.messages[1].subject).toBe("Snapshot campaign");
  });

  test("suggestion and event-question approvals snapshot", async () => {
    const { sendEventQuestionApprovedEmail, sendSuggestionApprovedEmail } =
      await import("../email");
    await sendSuggestionApprovedEmail({
      email: baseTicket.email,
      speaker: "Jane Doe",
      suggestionId: "00000000-0000-4000-8000-000000000003",
    });
    await sendEventQuestionApprovedEmail({
      email: baseTicket.email,
      question: "What inspired your work?",
      eventName: baseTicket.eventName,
      eventRoute: baseTicket.eventRoute,
    });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(summarizeMime(capture.messages[1].rawMime)).toMatchSnapshot();
  });
});
