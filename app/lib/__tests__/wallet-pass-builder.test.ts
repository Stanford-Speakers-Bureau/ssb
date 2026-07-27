import { afterEach, describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";

import {
  buildWalletPassFields,
  verifyApplePassAuth,
  type EventPassFields,
} from "../wallet-pass-builder";
import { deriveAppleWalletAuthToken } from "../wallet-links";

const previousWalletSecret = process.env.APPLE_WALLET_SECRET;
const previousBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

afterEach(() => {
  if (previousWalletSecret === undefined)
    Reflect.deleteProperty(process.env, "APPLE_WALLET_SECRET");
  else process.env.APPLE_WALLET_SECRET = previousWalletSecret;
  process.env.NEXT_PUBLIC_BASE_URL = previousBaseUrl;
});

describe("Apple Wallet pass builder", () => {
  it("accepts only the exact per-ticket ApplePass token", async () => {
    process.env.APPLE_WALLET_SECRET = "unit-test-wallet-secret";
    const token = await deriveAppleWalletAuthToken("ticket-1");
    const valid = new NextRequest("https://example.test/pass", {
      headers: { authorization: `ApplePass ${token}` },
    });
    const invalid = new NextRequest("https://example.test/pass", {
      headers: { authorization: "Bearer something-else" },
    });

    expect(await verifyApplePassAuth(valid, "ticket-1")).toBe(true);
    expect(await verifyApplePassAuth(valid, "ticket-2")).toBe(false);
    expect(await verifyApplePassAuth(invalid, "ticket-1")).toBe(false);
  });

  it("maps event and ticket data into PassKit fields", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://events.example.test";
    const event: EventPassFields = {
      name: "Ada Lovelace",
      doorsOpen: new Date("2030-01-01T18:30:00Z"),
      startTimeDate: new Date("2030-01-01T19:00:00Z"),
      venue: "Memorial Auditorium",
      img: null,
      appleWalletImg: null,
      venueLink: "https://maps.example.test/venue",
      route: "ada-lovelace",
      latitude: "37.4275",
      longitude: "-122.1697",
      address: "450 Jane Stanford Way",
      allowAdmittingStandby: true,
    };

    expect(
      buildWalletPassFields({
        ticketId: "ticket-1",
        email: "guest@example.test",
        name: "Guest",
        ticketType: "VIP",
        event,
        cancelled: true,
        checkedIn: false,
      }),
    ).toMatchObject({
      eventName: "Ada Lovelace",
      eventDoorTime: "2030-01-01T18:30:00.000Z",
      start_time_date: "2030-01-01T19:00:00.000Z",
      eventLink: "https://events.example.test/events/ada-lovelace",
      eventLat: 37.4275,
      eventLng: -122.1697,
      ticketId: "ticket-1",
      ticketType: "VIP",
      cancelled: true,
      checkedIn: false,
      admittingStandby: true,
    });
  });
});
