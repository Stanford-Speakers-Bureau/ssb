import { describe, expect, test } from "bun:test";
import {
  createAppleWalletToken,
  verifyAppleWalletToken,
  deriveAppleWalletAuthToken,
  verifyAppleWalletAuthToken,
  buildAppleWalletLink,
} from "../wallet-links";

describe("wallet-links — JWT token", () => {
  test("round trip: verify returns input claims", async () => {
    const token = await createAppleWalletToken({
      email: "User@Example.com ",
      ticketId: "ticket-wallet-1",
    });
    const claims = await verifyAppleWalletToken(token);
    expect(claims).toEqual({
      email: "user@example.com",
      ticketId: "ticket-wallet-1",
    });
  });

  test("round trip: email is normalized", async () => {
    const token = await createAppleWalletToken({
      email: "  BOB@STANFORD.EDU  ",
      ticketId: "ticket-wallet-2",
    });
    const claims = await verifyAppleWalletToken(token);
    expect(claims?.email).toBe("bob@stanford.edu");
  });

  test("tampered signature returns null", async () => {
    const token = await createAppleWalletToken({
      email: "user@example.com",
      ticketId: "ticket-wallet-3",
    });
    const parts = token.split(".");
    parts[2] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const result = await verifyAppleWalletToken(parts.join("."));
    expect(result).toBeNull();
  });

  test("garbage input returns null", async () => {
    expect(await verifyAppleWalletToken("not-a-jwt")).toBeNull();
    expect(await verifyAppleWalletToken("aaa.bbb.ccc")).toBeNull();
  });

  test("token with future eventEndTime verifies successfully", async () => {
    const futureEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const token = await createAppleWalletToken({
      email: "user@example.com",
      ticketId: "ticket-wallet-4",
      eventEndTime: futureEnd,
    });
    const claims = await verifyAppleWalletToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.ticketId).toBe("ticket-wallet-4");
  });
});

describe("wallet-links — auth token (HMAC-based)", () => {
  test("deriveAppleWalletAuthToken is deterministic for the same ticketId", async () => {
    const t1 = await deriveAppleWalletAuthToken("tid-stable");
    const t2 = await deriveAppleWalletAuthToken("tid-stable");
    expect(t1).toBe(t2);
  });

  test("deriveAppleWalletAuthToken produces different values for different ticketIds", async () => {
    const t1 = await deriveAppleWalletAuthToken("tid-aaa");
    const t2 = await deriveAppleWalletAuthToken("tid-bbb");
    expect(t1).not.toBe(t2);
  });

  test("verifyAppleWalletAuthToken accepts the derived token", async () => {
    const token = await deriveAppleWalletAuthToken("tid-verify-ok");
    expect(await verifyAppleWalletAuthToken("tid-verify-ok", token)).toBe(true);
  });

  test("verifyAppleWalletAuthToken rejects a wrong token", async () => {
    const token = await deriveAppleWalletAuthToken("tid-tamper");
    // flip one character
    const bad = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(await verifyAppleWalletAuthToken("tid-tamper", bad)).toBe(false);
  });

  test("verifyAppleWalletAuthToken rejects wrong ticketId", async () => {
    const token = await deriveAppleWalletAuthToken("correct-tid");
    expect(await verifyAppleWalletAuthToken("wrong-tid", token)).toBe(false);
  });

  test("verifyAppleWalletAuthToken rejects empty string", async () => {
    expect(await verifyAppleWalletAuthToken("tid-empty", "")).toBe(false);
  });
});

describe("wallet-links — buildAppleWalletLink", () => {
  test("URL targets /api/tickets/apple-wallet with wallet_token", async () => {
    const link = await buildAppleWalletLink({
      baseUrl: "https://example.com",
      email: "user@example.com",
      ticketId: "ticket-link-1",
    });
    const url = new URL(link);
    expect(url.pathname).toBe("/api/tickets/apple-wallet");
    const walletToken = url.searchParams.get("wallet_token");
    expect(walletToken).toBeTruthy();
    // Verify the embedded token round-trips
    const claims = await verifyAppleWalletToken(walletToken!);
    expect(claims).toEqual({ email: "user@example.com", ticketId: "ticket-link-1" });
  });
});
