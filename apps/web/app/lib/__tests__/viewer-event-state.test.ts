import { describe, expect, it } from "bun:test";

import {
  deriveViewerEventState,
  getAnonymousViewerEventState,
  toOptionalNumber,
} from "../viewer-event-state";

describe("viewer event state derivation", () => {
  it("returns the complete anonymous state", () => {
    expect(getAnonymousViewerEventState()).toEqual({
      authenticated: false,
      userEmail: null,
      ticketId: null,
      ticketType: null,
      ticketName: null,
      ticketScanned: false,
      isOnWaitlist: false,
      waitlistPosition: null,
      isNotified: false,
      allowAdmittingStandby: false,
    });
  });

  it("derives booleans, ticket fields, and a numeric waitlist position", () => {
    expect(
      deriveViewerEventState("viewer@example.test", {
        ticket_id: "ticket-1",
        ticket_type: "VIP",
        ticket_name: "Viewer",
        ticket_scanned: true,
        is_on_waitlist: true,
        waitlist_position: "7",
        is_notified: true,
        allow_admitting_standby: true,
      }),
    ).toEqual({
      authenticated: true,
      userEmail: "viewer@example.test",
      ticketId: "ticket-1",
      ticketType: "VIP",
      ticketName: "Viewer",
      ticketScanned: true,
      isOnWaitlist: true,
      waitlistPosition: 7,
      isNotified: true,
      allowAdmittingStandby: true,
    });
  });

  it("defaults an absent database row and rejects unsafe positions", () => {
    expect(
      deriveViewerEventState("viewer@example.test", undefined),
    ).toMatchObject({
      authenticated: true,
      ticketId: null,
      ticketScanned: false,
      isOnWaitlist: false,
      waitlistPosition: null,
    });
    expect(
      toOptionalNumber(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)),
    ).toBeNull();
    expect(toOptionalNumber("not-a-number")).toBeNull();
  });
});
