import { createHmac } from "crypto";
import { normalizeEmail } from "@/app/lib/validation";

const DEV_SECRET = "dev-secret-change-me-in-production-1234";
const DEFAULT_TOKEN_TTL_MS = 120 * 24 * 60 * 60 * 1000;
const EVENT_GRACE_PERIOD_MS = 60 * 24 * 60 * 60 * 1000;
const TOKEN_PURPOSE = "event_feedback";

function getFeedbackLinkSecret(): string {
  const secret =
    process.env.FEEDBACK_LINK_SECRET
    || process.env.SESSION_SECRET
    || (process.env.NODE_ENV === "production" ? null : DEV_SECRET);

  if (!secret) {
    throw new Error(
      "FEEDBACK_LINK_SECRET or SESSION_SECRET must be set in production.",
    );
  }

  return secret;
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveExpirationTimestamp(input: {
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}): number {
  const now = Date.now();
  const defaultExpiry = now + DEFAULT_TOKEN_TTL_MS;
  const eventEndTimestamp = toTimestamp(input.eventEndTime);
  const eventStartTimestamp = toTimestamp(input.eventStartTime);
  const eventExpiryBase = eventEndTimestamp ?? eventStartTimestamp;
  const eventBasedExpiry = eventExpiryBase
    ? eventExpiryBase + EVENT_GRACE_PERIOD_MS
    : null;

  return Math.floor(
    (eventBasedExpiry == null
      ? defaultExpiry
      : Math.min(defaultExpiry, eventBasedExpiry)) / 1000,
  );
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function buildEventFeedbackLink(input: {
  baseUrl: string;
  eventRoute: string;
  email: string;
  ticketId: string;
  eventId: string;
  score?: number | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}): Promise<string> {
  const url = new URL(`/events/${input.eventRoute}`, input.baseUrl);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    purpose: TOKEN_PURPOSE,
    email: normalizeEmail(input.email),
    ticketId: input.ticketId,
    eventId: input.eventId,
    iat: Math.floor(Date.now() / 1000),
    exp: resolveExpirationTimestamp({
      eventStartTime: input.eventStartTime,
      eventEndTime: input.eventEndTime,
    }),
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", getFeedbackLinkSecret())
    .update(signingInput)
    .digest();

  url.searchParams.set(
    "feedback_token",
    `${signingInput}.${toBase64Url(signature)}`,
  );

  if (typeof input.score === "number" && input.score >= 1 && input.score <= 10) {
    url.searchParams.set("feedback_score", String(input.score));
  }

  url.hash = "feedback";
  return url.toString();
}
