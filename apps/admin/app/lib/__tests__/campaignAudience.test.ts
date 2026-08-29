import { describe, expect, it } from "bun:test";

import { parseAudiences, validateSegments } from "../campaignAudience";

describe("campaign audience segments", () => {
  it("parses valid global and event-scoped segments", () => {
    expect(
      parseAudiences(
        JSON.stringify([
          { type: "newsletter", eventIds: [] },
          { type: "event_ticketholders", eventIds: [" event-1 ", ""] },
          {
            type: "event_ticket_type",
            eventIds: ["event-2"],
            ticketType: "VIP",
          },
        ]),
      ),
    ).toEqual([
      { type: "newsletter", eventIds: [] },
      { type: "event_ticketholders", eventIds: ["event-1"] },
      {
        type: "event_ticket_type",
        eventIds: ["event-2"],
        ticketType: "VIP",
      },
    ]);
  });

  it("drops malformed JSON and invalid segment entries", () => {
    expect(parseAudiences("not-json")).toEqual([]);
    expect(
      parseAudiences(
        JSON.stringify([
          { type: "unknown", eventIds: [] },
          { type: "event_ticketholders", eventIds: [] },
          {
            type: "event_ticket_type",
            eventIds: ["event-1"],
            ticketType: "INVALID",
          },
        ]),
      ),
    ).toEqual([]);
  });

  it("requires non-empty, correctly shaped validated segments", () => {
    expect(validateSegments([])).toBe(false);
    expect(
      validateSegments([{ type: "event_ticketholders", eventIds: [] }]),
    ).toBe(false);
    expect(
      validateSegments([
        { type: "event_ticket_type", eventIds: ["event-1"], ticketType: "VIP" },
        { type: "all_users", eventIds: [] },
      ]),
    ).toBe(true);
  });
});
