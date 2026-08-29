import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { buildAnnounceUnsubscribeLink } from "../unsubscribe-links";

// Mirror getUnsubscribeLinkSecret() in ../unsubscribe-links.ts — bun test
// auto-loads .env, so a configured SESSION_SECRET takes precedence over the
// dev fallback and the recomputed HMAC must use the same resolution order.
const SECRET =
  process.env.UNSUBSCRIBE_LINK_SECRET ||
  process.env.SESSION_SECRET ||
  "dev-secret-change-me-in-production-1234";

function base64urlDecode(s: string): string {
  // Restore padding
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

describe("admin unsubscribe-links", () => {
  test("token has three base64url segments with correct header", () => {
    const link = buildAnnounceUnsubscribeLink({
      baseUrl: "https://example.com",
      email: "user@example.com",
    });
    const token = new URL(link).searchParams.get("token")!;
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    // Verify each segment is non-empty base64url characters
    for (const part of parts) {
      expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
    }
    const header = JSON.parse(base64urlDecode(parts[0]));
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
  });

  test("payload has correct claims", () => {
    const link = buildAnnounceUnsubscribeLink({
      baseUrl: "https://example.com",
      email: "USER@Example.com ",
    });
    const token = new URL(link).searchParams.get("token")!;
    const parts = token.split(".");
    const payload = JSON.parse(base64urlDecode(parts[1]));
    expect(payload.purpose).toBe("email_unsubscribe");
    expect(payload.email).toBe("user@example.com");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  test("cross-app compatibility: signature verifies against HMAC recomputed with dev secret", () => {
    const link = buildAnnounceUnsubscribeLink({
      baseUrl: "https://example.com",
      email: "user@example.com",
    });
    const token = new URL(link).searchParams.get("token")!;
    const parts = token.split(".");
    const signingInput = `${parts[0]}.${parts[1]}`;
    const expectedSig = createHmac("sha256", SECRET)
      .update(signingInput)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(parts[2]).toBe(expectedSig);
    // Also assert payload survives JSON.parse after base64url decode
    const payload = JSON.parse(base64urlDecode(parts[1]));
    expect(payload.purpose).toBe("email_unsubscribe");
  });
});
