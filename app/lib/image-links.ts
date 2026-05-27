import { createHmac, timingSafeEqual } from "crypto";

const DEV_SECRET = "dev-secret-change-me-in-production-1234";
const TOKEN_PURPOSE = "event_image";

function getImageLinkSecret(): string {
  const secret =
    process.env.IMAGE_LINK_SECRET ||
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? null : DEV_SECRET);

  if (!secret) {
    throw new Error(
      "IMAGE_LINK_SECRET or SESSION_SECRET must be set in production.",
    );
  }

  return secret;
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Verifies an event-image access token minted by the admin app
 * (see admin `app/lib/image-links.ts`). A valid token lets ticket/campaign
 * emails display the hero image for unreleased ("mystery") events without
 * exposing the image to the public. Returns false for any missing/invalid
 * token or misconfigured secret (callers fall back to the normal 404).
 */
export function verifyEventImageToken(
  eventId: string,
  token: string | null | undefined,
): boolean {
  if (!token) {
    return false;
  }

  let secret: string;
  try {
    secret = getImageLinkSecret();
  } catch {
    return false;
  }

  const expected = toBase64Url(
    createHmac("sha256", secret).update(`${TOKEN_PURPOSE}:${eventId}`).digest(),
  );

  const provided = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(provided, expectedBuf);
}
