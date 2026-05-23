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

function getAppleWalletSecret(): Uint8Array {
  const secret = process.env.APPLE_WALLET_SECRET;

  if (!secret) {
    throw new Error("APPLE_WALLET_SECRET must be set for Apple Wallet updates.");
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

// Per-pass secret baked into the pass as `authenticationToken`. The device
// sends it back as `Authorization: ApplePass <token>` on every web-service
// call, so it must be stable for the life of the pass (no expiry) and
// re-derivable server-side from the ticket id alone. Use a dedicated long-lived
// secret so session-key rotation does not break already installed passes.
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function deriveAppleWalletAuthToken(
  ticketId: string,
): Promise<string> {
  const secret = getAppleWalletSecret();
  const keyData = secret.buffer.slice(
    secret.byteOffset,
    secret.byteOffset + secret.byteLength,
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`apple_wallet_auth:${ticketId}`),
  );
  return toHex(sig);
}

export async function verifyAppleWalletAuthToken(
  ticketId: string,
  token: string,
): Promise<boolean> {
  const expected = await deriveAppleWalletAuthToken(ticketId);
  if (expected.length !== token.length) {
    return false;
  }
  // length-independent compare to avoid leaking via early return
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
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
