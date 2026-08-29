import { describe, expect, test } from "bun:test";
import { getEventEndDate, isEventOver } from "../eventTime";
import { EVENT_END_FALLBACK_MS } from "../constants";

// Fixed reference timestamps (all in UTC)
const START_ISO = "2024-03-15T19:00:00.000Z"; // 7pm UTC
const END_ISO = "2024-03-15T21:30:00.000Z"; // 9:30pm UTC (2.5 hours later)
const START_DATE = new Date(START_ISO);
const END_DATE = new Date(END_ISO);

describe("getEventEndDate", () => {
  test("explicit endTime is returned as-is", () => {
    const result = getEventEndDate({ startTime: START_ISO, endTime: END_ISO });
    expect(result).toEqual(END_DATE);
  });

  test("explicit endTime as Date object is returned as-is", () => {
    const result = getEventEndDate({ startTime: START_DATE, endTime: END_DATE });
    expect(result).toEqual(END_DATE);
  });

  test("missing endTime falls back to startTime + EVENT_END_FALLBACK_MS", () => {
    const result = getEventEndDate({ startTime: START_ISO });
    const expected = new Date(START_DATE.getTime() + EVENT_END_FALLBACK_MS);
    expect(result).toEqual(expected);
  });

  test("missing endTime with custom fallbackDurationMs", () => {
    const customMs = 60 * 60 * 1000; // 1 hour
    const result = getEventEndDate({ startTime: START_ISO, fallbackDurationMs: customMs });
    const expected = new Date(START_DATE.getTime() + customMs);
    expect(result).toEqual(expected);
  });

  test("no startTime and no endTime returns null", () => {
    expect(getEventEndDate({})).toBeNull();
    expect(getEventEndDate({ startTime: null, endTime: null })).toBeNull();
  });

  test("null endTime with valid startTime uses fallback", () => {
    const result = getEventEndDate({ startTime: START_ISO, endTime: null });
    const expected = new Date(START_DATE.getTime() + EVENT_END_FALLBACK_MS);
    expect(result).toEqual(expected);
  });

  test("invalid endTime string falls through to startTime + fallback", () => {
    const result = getEventEndDate({ startTime: START_ISO, endTime: "not-a-date" });
    const expected = new Date(START_DATE.getTime() + EVENT_END_FALLBACK_MS);
    expect(result).toEqual(expected);
  });

  test("invalid startTime string returns null", () => {
    expect(getEventEndDate({ startTime: "not-a-date" })).toBeNull();
  });
});

describe("isEventOver", () => {
  test("just before explicit endTime returns false", () => {
    // 1ms before end
    const justBefore = new Date(END_DATE.getTime() - 1);
    expect(
      isEventOver({ startTime: START_ISO, endTime: END_ISO, now: justBefore }),
    ).toBe(false);
  });

  test("exactly at explicit endTime returns true (now >= eventEnd)", () => {
    expect(
      isEventOver({ startTime: START_ISO, endTime: END_ISO, now: END_DATE }),
    ).toBe(true);
  });

  test("after explicit endTime returns true", () => {
    const after = new Date(END_DATE.getTime() + 60_000);
    expect(
      isEventOver({ startTime: START_ISO, endTime: END_ISO, now: after }),
    ).toBe(true);
  });

  test("just before fallback end returns false", () => {
    const fallbackEnd = new Date(START_DATE.getTime() + EVENT_END_FALLBACK_MS);
    const justBefore = new Date(fallbackEnd.getTime() - 1);
    expect(
      isEventOver({ startTime: START_ISO, now: justBefore }),
    ).toBe(false);
  });

  test("exactly at fallback end returns true", () => {
    const fallbackEnd = new Date(START_DATE.getTime() + EVENT_END_FALLBACK_MS);
    expect(
      isEventOver({ startTime: START_ISO, now: fallbackEnd }),
    ).toBe(true);
  });

  test("no start, no end returns false (can't determine end)", () => {
    const now = new Date("2024-01-01T00:00:00Z");
    expect(isEventOver({ now })).toBe(false);
  });

  test("invalid startTime returns false", () => {
    const now = new Date("2030-01-01T00:00:00Z");
    expect(isEventOver({ startTime: "not-a-date", now })).toBe(false);
  });
});
