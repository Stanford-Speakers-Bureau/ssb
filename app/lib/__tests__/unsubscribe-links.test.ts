import { describe, expect, test } from "bun:test";
import {
  buildAnnounceUnsubscribeLink,
  buildEventUnsubscribeLink,
  verifyUnsubscribeToken,
} from "../unsubscribe-links";

describe("unsubscribe-links", () => {
  test("round trip: announce scope normalizes email", async () => {
    const link = await buildAnnounceUnsubscribeLink({
      baseUrl: "https://example.com",
      email: "Foo@Bar.com ",
    });
    const token = new URL(link).searchParams.get("token");
    expect(token).toBeTruthy();
    const claims = await verifyUnsubscribeToken(token!);
    expect(claims).toEqual({ scope: "announce", email: "foo@bar.com" });
  });

  test("round trip: event scope includes eventId", async () => {
    const link = await buildEventUnsubscribeLink({
      baseUrl: "https://example.com",
      email: "user@example.com",
      eventId: "evt-1",
    });
    const token = new URL(link).searchParams.get("token");
    expect(token).toBeTruthy();
    const claims = await verifyUnsubscribeToken(token!);
    expect(claims).toEqual({
      scope: "event",
      email: "user@example.com",
      eventId: "evt-1",
    });
  });

  test("tampered token returns null", async () => {
    const link = await buildAnnounceUnsubscribeLink({
      baseUrl: "https://example.com",
      email: "user@example.com",
    });
    const token = new URL(link).searchParams.get("token")!;
    // Replace the signature segment entirely with a different fixed string
    const parts = token.split(".");
    parts[2] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const tampered = parts.join(".");
    const result = await verifyUnsubscribeToken(tampered);
    expect(result).toBeNull();
  });

  test("garbage input returns null", async () => {
    const result = await verifyUnsubscribeToken("not-a-jwt");
    expect(result).toBeNull();
  });
});
