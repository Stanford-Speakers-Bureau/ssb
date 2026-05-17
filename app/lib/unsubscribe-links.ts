import { SignJWT, jwtVerify } from "jose";

const DEV_SECRET = "dev-secret-change-me-in-production-1234";
const DEFAULT_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const EVENT_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_PURPOSE = "email_unsubscribe";

export type UnsubscribeTokenClaims =
  | { scope: "announce"; email: string }
  | { scope: "newsletter"; email: string }
  | { scope: "event"; email: string; eventId: string };

function getUnsubscribeLinkSecret(): Uint8Array {
  const secret =
    process.env.UNSUBSCRIBE_LINK_SECRET
    || process.env.SESSION_SECRET
    || (process.env.NODE_ENV === "production" ? null : DEV_SECRET);

  if (!secret) {
    throw new Error(
      "UNSUBSCRIBE_LINK_SECRET or SESSION_SECRET must be set in production.",
    );
  }

  return new TextEncoder().encode(secret);
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

export async function buildAnnounceUnsubscribeLink(input: {
  baseUrl: string;
  email: string;
}): Promise<string> {
  const token = await new SignJWT({
    purpose: TOKEN_PURPOSE,
    scope: "announce",
    email: normalizeEmail(input.email),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + DEFAULT_TOKEN_TTL_MS) / 1000))
    .sign(getUnsubscribeLinkSecret());

  const url = new URL("/unsubscribe", input.baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function buildNewsletterUnsubscribeLink(input: {
  baseUrl: string;
  email: string;
}): Promise<string> {
  const token = await new SignJWT({
    purpose: TOKEN_PURPOSE,
    scope: "newsletter",
    email: normalizeEmail(input.email),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + DEFAULT_TOKEN_TTL_MS) / 1000))
    .sign(getUnsubscribeLinkSecret());

  const url = new URL("/unsubscribe", input.baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function buildEventUnsubscribeLink(input: {
  baseUrl: string;
  email: string;
  eventId: string;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}): Promise<string> {
  const token = await new SignJWT({
    purpose: TOKEN_PURPOSE,
    scope: "event",
    email: normalizeEmail(input.email),
    eventId: input.eventId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(
      resolveExpirationTimestamp({
        eventStartTime: input.eventStartTime,
        eventEndTime: input.eventEndTime,
      }),
    )
    .sign(getUnsubscribeLinkSecret());

  const url = new URL("/unsubscribe", input.baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function verifyUnsubscribeToken(
  token: string,
): Promise<UnsubscribeTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getUnsubscribeLinkSecret(), {
      algorithms: ["HS256"],
    });

    if (payload.purpose !== TOKEN_PURPOSE) return null;

    const email = typeof payload.email === "string"
      ? normalizeEmail(payload.email)
      : null;
    const scope = typeof payload.scope === "string" ? payload.scope : null;

    if (!email || !scope) return null;

    if (scope === "announce") {
      return { scope: "announce", email };
    }

    if (scope === "newsletter") {
      return { scope: "newsletter", email };
    }

    if (scope === "event") {
      const eventId = typeof payload.eventId === "string"
        ? payload.eventId
        : null;
      if (!eventId) return null;
      return { scope: "event", email, eventId };
    }

    return null;
  } catch {
    return null;
  }
}
