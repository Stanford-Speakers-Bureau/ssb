import { describe, expect, test } from "bun:test";
import {
  createCancellationToken,
  verifyCancellationToken,
  buildCancellationLink,
} from "../cancellation-links";

describe("cancellation-links", () => {
  test("round trip: verify returns input claims", async () => {
    const token = await createCancellationToken({
      email: "User@Example.com ",
      ticketId: "ticket-abc-123",
    });
    const claims = await verifyCancellationToken(token);
    // email is normalized (trimmed + lowercased) by the module
    expect(claims).toEqual({
      email: "user@example.com",
      ticketId: "ticket-abc-123",
    });
  });

  test("round trip: email normalization (trim + lowercase)", async () => {
    const token = await createCancellationToken({
      email: "  ALICE@EXAMPLE.COM  ",
      ticketId: "tid-1",
    });
    const claims = await verifyCancellationToken(token);
    expect(claims?.email).toBe("alice@example.com");
    expect(claims?.ticketId).toBe("tid-1");
  });

  test("tampered signature returns null", async () => {
    const token = await createCancellationToken({
      email: "user@example.com",
      ticketId: "tid-2",
    });
    const parts = token.split(".");
    parts[2] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const result = await verifyCancellationToken(parts.join("."));
    expect(result).toBeNull();
  });

  test("garbage input returns null", async () => {
    expect(await verifyCancellationToken("not-a-jwt")).toBeNull();
    expect(await verifyCancellationToken("")).toBeNull();
    expect(await verifyCancellationToken("aaa.bbb.ccc")).toBeNull();
  });

  test("token with future eventEndTime is valid", async () => {
    const futureEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const token = await createCancellationToken({
      email: "user@example.com",
      ticketId: "tid-3",
      eventEndTime: futureEnd,
    });
    const claims = await verifyCancellationToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.ticketId).toBe("tid-3");
  });

  test("buildCancellationLink: URL targets /cancel/<ticketId> with cancel_token", async () => {
    const link = await buildCancellationLink({
      baseUrl: "https://example.com",
      email: "user@example.com",
      ticketId: "ticket-xyz",
    });
    const url = new URL(link);
    expect(url.pathname).toBe("/cancel/ticket-xyz");
    const cancelToken = url.searchParams.get("cancel_token");
    expect(cancelToken).toBeTruthy();
    // The token in the link should verify successfully
    const claims = await verifyCancellationToken(cancelToken!);
    expect(claims).toEqual({ email: "user@example.com", ticketId: "ticket-xyz" });
  });

  test("buildCancellationLink: uses the baseUrl host correctly", async () => {
    const link = await buildCancellationLink({
      baseUrl: "https://tickets.stanfordspeakersbureau.com",
      email: "fan@stanford.edu",
      ticketId: "abc-def",
    });
    const url = new URL(link);
    expect(url.hostname).toBe("tickets.stanfordspeakersbureau.com");
    expect(url.pathname).toBe("/cancel/abc-def");
  });
});
