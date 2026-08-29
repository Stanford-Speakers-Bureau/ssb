import { createHmac } from "crypto";

const DEV_SECRET = "dev-secret-change-me-in-production-1234";
const DEFAULT_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const EVENT_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_PURPOSE = "email_unsubscribe";

function getUnsubscribeLinkSecret(): string {
  const secret =
    process.env.UNSUBSCRIBE_LINK_SECRET
    || process.env.SESSION_SECRET
    || (process.env.NODE_ENV === "production" ? null : DEV_SECRET);

  if (!secret) {
    throw new Error(
      "UNSUBSCRIBE_LINK_SECRET or SESSION_SECRET must be set in production.",
    );
  }

  return secret;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
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
      : Math.max(defaultExpiry, eventBasedExpiry)) / 1000,
  );
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildToken(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", getUnsubscribeLinkSecret())
    .update(signingInput)
    .digest();
  return `${signingInput}.${toBase64Url(signature)}`;
}

export function buildAnnounceUnsubscribeLink(input: {
  baseUrl: string;
  email: string;
}): string {
  const token = buildToken({
    purpose: TOKEN_PURPOSE,
    scope: "announce",
    email: normalizeEmail(input.email),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + DEFAULT_TOKEN_TTL_MS) / 1000),
  });

  const url = new URL("/unsubscribe", input.baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildNewsletterUnsubscribeLink(input: {
  baseUrl: string;
  email: string;
}): string {
  const token = buildToken({
    purpose: TOKEN_PURPOSE,
    scope: "newsletter",
    email: normalizeEmail(input.email),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + DEFAULT_TOKEN_TTL_MS) / 1000),
  });

  const url = new URL("/unsubscribe", input.baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildEventUnsubscribeLink(input: {
  baseUrl: string;
  email: string;
  eventId: string;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}): string {
  const token = buildToken({
    purpose: TOKEN_PURPOSE,
    scope: "event",
    email: normalizeEmail(input.email),
    eventId: input.eventId,
    iat: Math.floor(Date.now() / 1000),
    exp: resolveExpirationTimestamp({
      eventStartTime: input.eventStartTime,
      eventEndTime: input.eventEndTime,
    }),
  });

  const url = new URL("/unsubscribe", input.baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
