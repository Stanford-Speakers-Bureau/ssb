/**
 * Turns an SES bounce/complaint notification (the `Message` inside an SNS
 * envelope) into one entry per affected recipient, each marked with whether
 * we should stop emailing that address.
 *
 * Handles both SES formats:
 *   - identity feedback notifications: { notificationType: "Bounce", ... }
 *   - configuration-set event publishing: { eventType: "Bounce", ... }
 *
 * Only hard failures suppress:
 *   - Permanent bounces (address doesn't exist, mailbox disabled, etc.)
 *   - Spam complaints (except feedback type "not-spam")
 * Transient/undetermined bounces (mailbox full, greylisting, etc.) are
 * recorded but not suppressed; they usually clear up on their own.
 */

export type FeedbackRecipient = {
  email: string;
  reason: "bounce" | "complaint";
  /** Whether this recipient should be added to the suppression list. */
  suppress: boolean;
  /** e.g. "Permanent/General", "Transient/MailboxFull", "Complaint/abuse" */
  type: string;
  /** The receiving server's response, when SES includes one. */
  diagnostic: string | null;
};

export type SesFeedback = {
  kind: "bounce" | "complaint" | "other";
  recipients: FeedbackRecipient[];
  /** Raw notification type when kind is "other". */
  otherType?: string | null;
  subject: string | null;
  sesMessageId: string | null;
};

type Recipient = { emailAddress?: unknown; diagnosticCode?: unknown };

function extractAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const angle = value.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : value).trim().toLowerCase();
  return addr.includes("@") ? addr : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truncate(value: string | null, max = 300): string | null {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function recipientList(value: unknown): Recipient[] {
  return Array.isArray(value) ? value : [];
}

export function parseSesFeedback(message: unknown): SesFeedback {
  const m = (message && typeof message === "object" ? message : {}) as Record<
    string,
    any
  >;
  const notificationType = str(m.notificationType) ?? str(m.eventType);
  const mail = (m.mail ?? {}) as Record<string, any>;
  const base = {
    subject: str(mail.commonHeaders?.subject),
    sesMessageId: str(mail.messageId),
  };

  if (notificationType === "Bounce") {
    const bounce = (m.bounce ?? {}) as Record<string, any>;
    const bounceType = str(bounce.bounceType) ?? "Undetermined";
    const subType = str(bounce.bounceSubType) ?? "General";
    const recipients: FeedbackRecipient[] = [];
    for (const r of recipientList(bounce.bouncedRecipients)) {
      const email = extractAddress(r?.emailAddress);
      if (!email) continue;
      recipients.push({
        email,
        reason: "bounce",
        suppress: bounceType === "Permanent",
        type: `${bounceType}/${subType}`,
        diagnostic: truncate(str(r?.diagnosticCode)),
      });
    }
    return { kind: "bounce", recipients, ...base };
  }

  if (notificationType === "Complaint") {
    const complaint = (m.complaint ?? {}) as Record<string, any>;
    const feedbackType = str(complaint.complaintFeedbackType) ?? "unspecified";
    const recipients: FeedbackRecipient[] = [];
    for (const r of recipientList(complaint.complainedRecipients)) {
      const email = extractAddress(r?.emailAddress);
      if (!email) continue;
      recipients.push({
        email,
        reason: "complaint",
        suppress: feedbackType !== "not-spam",
        type: `Complaint/${feedbackType}`,
        diagnostic: null,
      });
    }
    return { kind: "complaint", recipients, ...base };
  }

  return {
    kind: "other",
    recipients: [],
    otherType: notificationType,
    ...base,
  };
}
