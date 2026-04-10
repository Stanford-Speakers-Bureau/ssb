import { SignJWT, jwtVerify } from "jose";

const DEV_SECRET = "dev-secret-change-me-in-production-1234";
const DEFAULT_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const EVENT_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_PURPOSE = "ticket_apple_wallet";

export type AppleWalletTokenClaims = {
  email: string;
  ticketId: string;
};

function getWalletLinkSecret(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET
    || (process.env.NODE_ENV === "production" ? null : DEV_SECRET);

  if (!secret) {
    throw new Error(
      "SESSION_SECRET must be set in production.",
    );
  }

  return new TextEncoder().encode(secret);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

export async function createAppleWalletToken(input: {
  email: string;
  ticketId: string;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}): Promise<string> {
  return new SignJWT({
    purpose: TOKEN_PURPOSE,
    email: normalizeEmail(input.email),
    ticketId: input.ticketId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(
      resolveExpirationTimestamp({
        eventStartTime: input.eventStartTime,
        eventEndTime: input.eventEndTime,
      }),
    )
    .sign(getWalletLinkSecret());
}

export async function verifyAppleWalletToken(
  token: string,
): Promise<AppleWalletTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getWalletLinkSecret(), {
      algorithms: ["HS256"],
    });

    if (payload.purpose !== TOKEN_PURPOSE) {
      return null;
    }

    const email = typeof payload.email === "string" ? payload.email : null;
    const ticketId = typeof payload.ticketId === "string"
      ? payload.ticketId
      : null;

    if (!email || !ticketId) {
      return null;
    }

    return {
      email: normalizeEmail(email),
      ticketId,
    };
  } catch {
    return null;
  }
}

export async function buildAppleWalletLink(input: {
  baseUrl: string;
  email: string;
  ticketId: string;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}): Promise<string> {
  const url = new URL("/api/tickets/apple-wallet", input.baseUrl);
  const token = await createAppleWalletToken({
    email: input.email,
    ticketId: input.ticketId,
    eventStartTime: input.eventStartTime,
    eventEndTime: input.eventEndTime,
  });

  url.searchParams.set("wallet_token", token);
  return url.toString();
}
