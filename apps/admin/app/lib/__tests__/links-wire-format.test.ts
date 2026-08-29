import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { buildCancellationLink } from "../cancellation-links";
import { buildEventFeedbackLink } from "../feedback-links";

// Mirror getCancellationLinkSecret() in ../cancellation-links.ts
// bun test auto-loads .env; if CANCELLATION_LINK_SECRET or SESSION_SECRET is set
// there, the module uses it — so the recomputed HMAC must use the same resolution order.
const CANCEL_SECRET =
  process.env.CANCELLATION_LINK_SECRET ||
  process.env.SESSION_SECRET ||
  "dev-secret-change-me-in-production-1234";

// Mirror getFeedbackLinkSecret() in ../feedback-links.ts
const FEEDBACK_SECRET =
  process.env.FEEDBACK_LINK_SECRET ||
  process.env.SESSION_SECRET ||
  "dev-secret-change-me-in-production-1234";

function base64urlDecode(s: string): string {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function recomputeHmacSig(signingInput: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("admin buildCancellationLink wire format", () => {
  test("token has three base64url segments", async () => {
    const link = await buildCancellationLink({
      baseUrl: "https://example.com",
      email: "user@example.com",
      ticketId: "tid-1",
    });
    const token = new URL(link).searchParams.get("cancel_token")!;
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  test("header decodes to {alg:'HS256', typ:'JWT'}", async () => {
    const link = await buildCancellationLink({
      baseUrl: "https://example.com",
      email: "user@example.com",
      ticketId: "tid-2",
    });
    const token = new URL(link).searchParams.get("cancel_token")!;
    const [headerB64] = token.split(".");
    const header = JSON.parse(base64urlDecode(headerB64));
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
  });

  test("payload has correct claim names and normalizes email", async () => {
    const link = await buildCancellationLink({
      baseUrl: "https://example.com",
      email: "  USER@EXAMPLE.COM  ",
      ticketId: "tid-3",
    });
    const token = new URL(link).searchParams.get("cancel_token")!;
    const [, payloadB64] = token.split(".");
    const payload = JSON.parse(base64urlDecode(payloadB64));
    expect(payload.purpose).toBe("ticket_cancel");
    expect(payload.email).toBe("user@example.com");
    expect(payload.ticketId).toBe("tid-3");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  test("signature verifies against HMAC recomputed with secret", async () => {
    const link = await buildCancellationLink({
      baseUrl: "https://example.com",
      email: "user@example.com",
      ticketId: "tid-sig",
    });
    const token = new URL(link).searchParams.get("cancel_token")!;
    const parts = token.split(".");
    const signingInput = `${parts[0]}.${parts[1]}`;
    const expected = recomputeHmacSig(signingInput, CANCEL_SECRET);
    expect(parts[2]).toBe(expected);
  });

  test("URL path is /cancel/<ticketId>", async () => {
    const link = await buildCancellationLink({
      baseUrl: "https://example.com",
      email: "user@example.com",
      ticketId: "ticket-abc",
    });
    const url = new URL(link);
    expect(url.pathname).toBe("/cancel/ticket-abc");
  });
});

describe("admin buildEventFeedbackLink wire format", () => {
  test("token has three base64url segments", async () => {
    const link = await buildEventFeedbackLink({
      baseUrl: "https://example.com",
      eventRoute: "test-event",
      email: "user@example.com",
      ticketId: "tid-f1",
      eventId: "evt-f1",
    });
    const token = new URL(link).searchParams.get("feedback_token")!;
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  test("header decodes to {alg:'HS256', typ:'JWT'}", async () => {
    const link = await buildEventFeedbackLink({
      baseUrl: "https://example.com",
      eventRoute: "test-event",
      email: "user@example.com",
      ticketId: "tid-f2",
      eventId: "evt-f2",
    });
    const token = new URL(link).searchParams.get("feedback_token")!;
    const [headerB64] = token.split(".");
    const header = JSON.parse(base64urlDecode(headerB64));
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
  });

  test("payload has correct claim names", async () => {
    const link = await buildEventFeedbackLink({
      baseUrl: "https://example.com",
      eventRoute: "test-event",
      email: "  ALICE@EXAMPLE.COM  ",
      ticketId: "tid-f3",
      eventId: "evt-f3",
    });
    const token = new URL(link).searchParams.get("feedback_token")!;
    const [, payloadB64] = token.split(".");
    const payload = JSON.parse(base64urlDecode(payloadB64));
    expect(payload.purpose).toBe("event_feedback");
    expect(payload.email).toBe("alice@example.com"); // normalized
    expect(payload.ticketId).toBe("tid-f3");
    expect(payload.eventId).toBe("evt-f3");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  test("signature verifies against HMAC recomputed with secret", async () => {
    const link = await buildEventFeedbackLink({
      baseUrl: "https://example.com",
      eventRoute: "test-event",
      email: "user@example.com",
      ticketId: "tid-fsig",
      eventId: "evt-fsig",
    });
    const token = new URL(link).searchParams.get("feedback_token")!;
    const parts = token.split(".");
    const signingInput = `${parts[0]}.${parts[1]}`;
    const expected = recomputeHmacSig(signingInput, FEEDBACK_SECRET);
    expect(parts[2]).toBe(expected);
  });

  test("URL path is /events/<eventRoute>", async () => {
    const link = await buildEventFeedbackLink({
      baseUrl: "https://example.com",
      eventRoute: "my-event-route",
      email: "user@example.com",
      ticketId: "tid-path",
      eventId: "evt-path",
    });
    const url = new URL(link);
    expect(url.pathname).toBe("/events/my-event-route");
  });

  test("URL fragment is #feedback", async () => {
    const link = await buildEventFeedbackLink({
      baseUrl: "https://example.com",
      eventRoute: "my-event",
      email: "user@example.com",
      ticketId: "tid-hash",
      eventId: "evt-hash",
    });
    const url = new URL(link);
    expect(url.hash).toBe("#feedback");
  });

  test("numeric score in [1,10] is included as feedback_score param", async () => {
    const link = await buildEventFeedbackLink({
      baseUrl: "https://example.com",
      eventRoute: "my-event",
      email: "user@example.com",
      ticketId: "tid-score",
      eventId: "evt-score",
      score: 8,
    });
    const url = new URL(link);
    expect(url.searchParams.get("feedback_score")).toBe("8");
  });

  test("score=0 is NOT included (out of [1,10] range)", async () => {
    const link = await buildEventFeedbackLink({
      baseUrl: "https://example.com",
      eventRoute: "my-event",
      email: "user@example.com",
      ticketId: "tid-score0",
      eventId: "evt-score0",
      score: 0,
    });
    const url = new URL(link);
    expect(url.searchParams.get("feedback_score")).toBeNull();
  });
});
