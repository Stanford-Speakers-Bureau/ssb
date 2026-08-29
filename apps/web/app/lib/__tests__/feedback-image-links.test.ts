import { describe, expect, test } from "bun:test";
import { SignJWT } from "jose";
import { createHmac } from "node:crypto";
import { verifyEventFeedbackToken } from "../feedback-links";
import { verifyEventImageToken } from "../image-links";

// Mirror getFeedbackLinkSecret() resolution order in ../feedback-links.ts
// bun test auto-loads .env; if FEEDBACK_LINK_SECRET or SESSION_SECRET is set
// there, the module uses it — so we must use the same resolution order here.
const FEEDBACK_SECRET =
  process.env.FEEDBACK_LINK_SECRET ||
  process.env.SESSION_SECRET ||
  "dev-secret-change-me-in-production-1234";

// Mirror getImageLinkSecret() resolution order in ../image-links.ts
const IMAGE_SECRET =
  process.env.IMAGE_LINK_SECRET ||
  process.env.SESSION_SECRET ||
  "dev-secret-change-me-in-production-1234";

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("verifyEventFeedbackToken", () => {
  test("garbage input returns null", async () => {
    expect(await verifyEventFeedbackToken("not-a-jwt")).toBeNull();
    expect(await verifyEventFeedbackToken("aaa.bbb.ccc")).toBeNull();
    expect(await verifyEventFeedbackToken("")).toBeNull();
  });

  test("tampered signature returns null", async () => {
    // Build a real token in-test using the same secret
    const secretBytes = new TextEncoder().encode(FEEDBACK_SECRET);
    const realToken = await new SignJWT({
      purpose: "event_feedback",
      email: "user@example.com",
      ticketId: "tid-1",
      eventId: "evt-1",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secretBytes);

    const parts = realToken.split(".");
    parts[2] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    expect(await verifyEventFeedbackToken(parts.join("."))).toBeNull();
  });

  test("valid token with correct claims verifies successfully", async () => {
    // Construct a valid token mirroring exactly what admin's buildEventFeedbackLink builds
    const secretBytes = new TextEncoder().encode(FEEDBACK_SECRET);
    const token = await new SignJWT({
      purpose: "event_feedback",
      email: "alice@example.com",
      ticketId: "ticket-abc",
      eventId: "event-xyz",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(secretBytes);

    const claims = await verifyEventFeedbackToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.email).toBe("alice@example.com");
    expect(claims?.ticketId).toBe("ticket-abc");
    expect(claims?.eventId).toBe("event-xyz");
  });

  test("token with wrong purpose returns null", async () => {
    const secretBytes = new TextEncoder().encode(FEEDBACK_SECRET);
    const token = await new SignJWT({
      purpose: "wrong_purpose",
      email: "user@example.com",
      ticketId: "tid-1",
      eventId: "evt-1",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secretBytes);

    expect(await verifyEventFeedbackToken(token)).toBeNull();
  });

  test("token missing required claims returns null", async () => {
    const secretBytes = new TextEncoder().encode(FEEDBACK_SECRET);
    // Missing eventId
    const token = await new SignJWT({
      purpose: "event_feedback",
      email: "user@example.com",
      ticketId: "tid-1",
      // no eventId
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secretBytes);

    expect(await verifyEventFeedbackToken(token)).toBeNull();
  });

  test("email is normalized (trimmed+lowercased) on return", async () => {
    const secretBytes = new TextEncoder().encode(FEEDBACK_SECRET);
    // The module calls normalizeEmail on the retrieved email claim
    const token = await new SignJWT({
      purpose: "event_feedback",
      email: "  ALICE@EXAMPLE.COM  ",
      ticketId: "tid-norm",
      eventId: "evt-norm",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secretBytes);

    const claims = await verifyEventFeedbackToken(token);
    expect(claims?.email).toBe("alice@example.com");
  });
});

describe("verifyEventImageToken", () => {
  test("null/undefined/empty token returns false", () => {
    expect(verifyEventImageToken("evt-1", null)).toBe(false);
    expect(verifyEventImageToken("evt-1", undefined)).toBe(false);
    expect(verifyEventImageToken("evt-1", "")).toBe(false);
  });

  test("garbage token returns false", () => {
    expect(verifyEventImageToken("evt-1", "not-a-real-token")).toBe(false);
    expect(verifyEventImageToken("evt-1", "AAAAAAAAAAAAA")).toBe(false);
  });

  test("token for different eventId returns false", () => {
    // Compute a valid token for evt-1
    const expected = toBase64Url(
      createHmac("sha256", IMAGE_SECRET).update("event_image:evt-1").digest(),
    );
    // But verify against evt-2
    expect(verifyEventImageToken("evt-2", expected)).toBe(false);
  });

  test("valid token for eventId verifies successfully", () => {
    // Mirror getImageLinkSecret() and the token construction in image-links.ts
    const eventId = "evt-valid-123";
    const expected = toBase64Url(
      createHmac("sha256", IMAGE_SECRET)
        .update(`event_image:${eventId}`)
        .digest(),
    );
    expect(verifyEventImageToken(eventId, expected)).toBe(true);
  });

  test("token with wrong length returns false (length check before compare)", () => {
    expect(verifyEventImageToken("evt-1", "short")).toBe(false);
  });
});
