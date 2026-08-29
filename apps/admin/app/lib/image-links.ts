import { createHmac } from "crypto";

const DEV_SECRET = "dev-secret-change-me-in-production-1234";
const TOKEN_PURPOSE = "event_image";

function getImageLinkSecret(): string {
  const secret =
    process.env.IMAGE_LINK_SECRET
    || process.env.SESSION_SECRET
    || (process.env.NODE_ENV === "production" ? null : DEV_SECRET);

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
 * Builds a stable, non-expiring HMAC token authorizing access to an event's
 * image while the event is still unreleased (a "mystery" event). Ticket and
 * campaign emails embed this on the `/api/images/{eventId}` URL so the hero
 * image renders before the event is public, without exposing it to anyone who
 * merely knows the event id. The web image route verifies it with the same
 * secret (see web `app/lib/image-links.ts`). It does not expire because the
 * image becomes public on release and an email may be opened much later.
 */
export function buildEventImageToken(eventId: string): string {
  const signature = createHmac("sha256", getImageLinkSecret())
    .update(`${TOKEN_PURPOSE}:${eventId}`)
    .digest();

  return toBase64Url(signature);
}
