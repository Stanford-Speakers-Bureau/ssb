import { describe, expect, test } from "bun:test";
import { parseSesFeedback } from "../ses-feedback";

const mail = {
  messageId: "ses-123",
  commonHeaders: { subject: "Amanda Gorman is coming to Stanford!" },
};

describe("parseSesFeedback", () => {
  test("permanent bounce marks each recipient for suppression", () => {
    const result = parseSesFeedback({
      notificationType: "Bounce",
      mail,
      bounce: {
        bounceType: "Permanent",
        bounceSubType: "General",
        bouncedRecipients: [
          {
            emailAddress: "GCGraci@Stanford.edu",
            diagnosticCode: "smtp; 550 5.1.1 user unknown",
          },
          { emailAddress: "Someone <other@stanford.edu>" },
        ],
      },
    });
    expect(result.kind).toBe("bounce");
    expect(result.subject).toBe("Amanda Gorman is coming to Stanford!");
    expect(result.sesMessageId).toBe("ses-123");
    expect(result.recipients).toEqual([
      {
        email: "gcgraci@stanford.edu",
        reason: "bounce",
        suppress: true,
        type: "Permanent/General",
        diagnostic: "smtp; 550 5.1.1 user unknown",
      },
      {
        email: "other@stanford.edu",
        reason: "bounce",
        suppress: true,
        type: "Permanent/General",
        diagnostic: null,
      },
    ]);
  });

  test("configuration-set event format (eventType) works too", () => {
    const result = parseSesFeedback({
      eventType: "Bounce",
      mail,
      bounce: {
        bounceType: "Permanent",
        bounceSubType: "NoEmail",
        bouncedRecipients: [{ emailAddress: "a@b.com" }],
      },
    });
    expect(result.recipients.map((r) => [r.email, r.type])).toEqual([
      ["a@b.com", "Permanent/NoEmail"],
    ]);
  });

  test("transient bounces are recorded but not suppressed", () => {
    const result = parseSesFeedback({
      notificationType: "Bounce",
      mail,
      bounce: {
        bounceType: "Transient",
        bounceSubType: "MailboxFull",
        bouncedRecipients: [{ emailAddress: "full@b.com" }],
      },
    });
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]).toMatchObject({
      email: "full@b.com",
      suppress: false,
      type: "Transient/MailboxFull",
    });
  });

  test("undetermined bounces are not suppressed", () => {
    const result = parseSesFeedback({
      notificationType: "Bounce",
      bounce: {
        bounceType: "Undetermined",
        bouncedRecipients: [{ emailAddress: "x@b.com" }],
      },
    });
    expect(result.recipients[0].suppress).toBe(false);
  });

  test("complaints suppress", () => {
    const result = parseSesFeedback({
      notificationType: "Complaint",
      mail,
      complaint: {
        complaintFeedbackType: "abuse",
        complainedRecipients: [{ emailAddress: "angry@b.com" }],
      },
    });
    expect(result.recipients).toEqual([
      {
        email: "angry@b.com",
        reason: "complaint",
        suppress: true,
        type: "Complaint/abuse",
        diagnostic: null,
      },
    ]);
  });

  test("not-spam complaints are recorded but not suppressed", () => {
    const result = parseSesFeedback({
      notificationType: "Complaint",
      complaint: {
        complaintFeedbackType: "not-spam",
        complainedRecipients: [{ emailAddress: "fine@b.com" }],
      },
    });
    expect(result.recipients[0].suppress).toBe(false);
  });

  test("delivery and other events are ignored", () => {
    const delivery = parseSesFeedback({ notificationType: "Delivery" });
    expect(delivery.kind).toBe("other");
    expect(delivery.otherType).toBe("Delivery");
    expect(parseSesFeedback("garbage").recipients).toEqual([]);
  });

  test("skips recipients without a usable address", () => {
    const result = parseSesFeedback({
      notificationType: "Bounce",
      bounce: {
        bounceType: "Permanent",
        bouncedRecipients: [{ emailAddress: "" }, {}, null],
      },
    });
    expect(result.recipients).toEqual([]);
  });
});
