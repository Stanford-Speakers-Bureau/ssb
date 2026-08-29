import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  captureSesFetch,
  summarizeMime,
} from "../../../tests/helpers/ses-capture";

const baseTicket = {
  email: "ticket-holder@example.test",
  name: "Test Ticket Holder",
  eventName: "Email Snapshot Event",
  eventStartTime: "2030-01-15T19:00:00-08:00",
  eventEndTime: "2030-01-15T21:00:00-08:00",
  eventRoute: "email-snapshot-event",
  ticketId: "00000000-0000-4000-8000-000000000001",
  eventVenue: "Test Auditorium",
  doorsOpenTime: "2030-01-15T18:30:00-08:00",
};

describe("ticket email MIME snapshots", () => {
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

  test("standard ticket includes alternative bodies, QR, and calendar", async () => {
    const { sendTicketEmail } = await import("../email");
    await sendTicketEmail({ ...baseTicket, ticketType: "STANDARD" });

    expect(capture.messages).toHaveLength(1);
    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].rawMime).toContain("Content-Type: image/png");
    expect(capture.messages[0].rawMime).toContain(
      "Content-Type: text/calendar",
    );
  });

  test("standby ticket deliberately omits the scannable QR", async () => {
    const { sendTicketEmail } = await import("../email");
    await sendTicketEmail({ ...baseTicket, ticketType: "STANDBY" });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].rawMime).not.toContain(
      "Content-Type: image/png",
    );
  });

  test("VIP ticket retains QR and calendar attachments", async () => {
    const { sendTicketEmail } = await import("../email");
    await sendTicketEmail({ ...baseTicket, ticketType: "VIP" });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].rawMime).toContain("Content-Type: image/png");
    expect(capture.messages[0].subject).toContain(baseTicket.eventName);
  });

  test("waitlist confirmation snapshots its position-focused MIME", async () => {
    const { sendWaitlistEmail } = await import("../email");
    await sendWaitlistEmail({
      email: baseTicket.email,
      eventName: baseTicket.eventName,
      position: 3,
      eventStartTime: baseTicket.eventStartTime,
      eventVenue: baseTicket.eventVenue,
      eventRoute: baseTicket.eventRoute,
    });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].subject).toContain("waitlist");
  });

  test("cancellation confirmation has no ticket attachments", async () => {
    const { sendCancellationEmail } = await import("../email");
    await sendCancellationEmail({ ...baseTicket, ticketType: "STANDARD" });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].rawMime).not.toContain(
      "Content-Type: image/png",
    );
    expect(capture.messages[0].subject).toContain("Cancellation Confirmed");
  });

  test("VIP scan notification captures internal alert structure", async () => {
    const { sendVIPScanNotification } = await import("../email");
    await sendVIPScanNotification({
      attendeeEmail: baseTicket.email,
      attendeeName: baseTicket.name,
      eventName: baseTicket.eventName,
      ticketId: baseTicket.ticketId,
      scanTime: "2030-01-15T19:30:00-08:00",
      scannerName: "Test Scanner",
      scannerEmail: "scanner@example.test",
    });

    expect(summarizeMime(capture.messages[0].rawMime)).toMatchSnapshot();
    expect(capture.messages[0].subject).toContain("VIP Ticket Scanned");
  });
});
