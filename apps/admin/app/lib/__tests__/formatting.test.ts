import { describe, expect, test } from "bun:test";
import { formatDate, formatDateShort, sortByStartDate } from "../formatting";
import { getNextEventId } from "../eventUtils";
import {
  DEFAULT_CANCEL_CALLOUT_TEXT,
  parseCancelCalloutText,
} from "../cancelCallout";

// Fixed UTC instants chosen on both sides of the DST boundary to exercise
// PACIFIC_TIMEZONE conversion:
//   - January (PST, UTC-8): 2024-01-15T20:00:00Z → 12:00 PM PST
//   - July    (PDT, UTC-7): 2024-07-15T20:00:00Z → 1:00 PM PDT
const JAN_UTC = "2024-01-15T20:00:00.000Z"; // PST (UTC-8)
const JUL_UTC = "2024-07-15T20:00:00.000Z"; // PDT (UTC-7)

describe("formatDate", () => {
  test("null returns N/A", () => {
    expect(formatDate(null)).toBe("N/A");
  });

  test("invalid string returns N/A", () => {
    expect(formatDate("not-a-date")).toBe("N/A");
  });

  test("January date shows correct calendar day (Pacific PST)", () => {
    // 2024-01-15T20:00Z = Jan 15 in Pacific (UTC-8 = 12:00 PM)
    const result = formatDate(JAN_UTC);
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  test("July date shows correct calendar day (Pacific PDT)", () => {
    // 2024-07-15T20:00Z = Jul 15 in Pacific (UTC-7 = 1:00 PM)
    const result = formatDate(JUL_UTC);
    expect(result).toContain("Jul");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  test("returns a string (parseable output)", () => {
    const result = formatDate(JAN_UTC);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("DST: January PST shows PM time (12:00 PM)", () => {
    // UTC 20:00 → PST 12:00 PM (UTC-8)
    const result = formatDate(JAN_UTC);
    expect(result).toContain("12:00");
    expect(result.toLowerCase()).toContain("pm");
  });

  test("DST: July PDT shows PM time (1:00 PM)", () => {
    // UTC 20:00 → PDT 1:00 PM (UTC-7)
    const result = formatDate(JUL_UTC);
    expect(result).toContain("1:00");
    expect(result.toLowerCase()).toContain("pm");
  });
});

describe("formatDateShort", () => {
  test("null returns N/A", () => {
    expect(formatDateShort(null)).toBe("N/A");
  });

  test("January date contains month/day/year in Pacific", () => {
    const result = formatDateShort(JAN_UTC);
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  test("July date contains month/day/year in Pacific", () => {
    const result = formatDateShort(JUL_UTC);
    expect(result).toContain("Jul");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });
});

describe("sortByStartDate", () => {
  test("sorts descending (newest first)", () => {
    const items = [
      { start_time_date: "2024-01-01T00:00:00Z" },
      { start_time_date: "2024-03-01T00:00:00Z" },
      { start_time_date: "2024-02-01T00:00:00Z" },
    ];
    const sorted = sortByStartDate(items);
    expect(sorted[0]?.start_time_date).toBe("2024-03-01T00:00:00Z");
    expect(sorted[1]?.start_time_date).toBe("2024-02-01T00:00:00Z");
    expect(sorted[2]?.start_time_date).toBe("2024-01-01T00:00:00Z");
  });

  test("handles null start_time_date (null sorts as empty string, before real dates)", () => {
    const items = [
      { start_time_date: "2024-01-01T00:00:00Z" },
      { start_time_date: null },
    ];
    const sorted = sortByStartDate(items);
    // "2024-01-01..." localeCompare "" > 0, so null sorts to the end (after real dates)
    expect(sorted[0]?.start_time_date).toBe("2024-01-01T00:00:00Z");
    expect(sorted[1]?.start_time_date).toBeNull();
  });

  test("does not mutate the original array", () => {
    const items = [
      { start_time_date: "2024-01-01T00:00:00Z" },
      { start_time_date: "2024-02-01T00:00:00Z" },
    ];
    const original = [...items];
    sortByStartDate(items);
    expect(items[0]).toBe(original[0]);
    expect(items[1]).toBe(original[1]);
  });

  test("empty array returns empty array", () => {
    expect(sortByStartDate([])).toEqual([]);
  });
});

describe("getNextEventId", () => {
  test("returns empty string for empty array", () => {
    expect(getNextEventId([])).toBe("");
  });

  test("returns id of the next upcoming event", () => {
    // Use fixed ISO strings in the past and future relative to "now"
    // To avoid depending on new Date(), we use far-future dates that will
    // always be "upcoming" for the foreseeable future.
    const far_future1 = "2099-01-01T00:00:00.000Z";
    const far_future2 = "2099-06-01T00:00:00.000Z";
    const far_past = "2000-01-01T00:00:00.000Z";

    const events = [
      { id: "evt-past", start_time_date: far_past },
      { id: "evt-future1", start_time_date: far_future1 },
      { id: "evt-future2", start_time_date: far_future2 },
    ];
    // Should return the nearest upcoming event (far_future1 < far_future2)
    expect(getNextEventId(events)).toBe("evt-future1");
  });

  test("falls back to last dated event if all are in the past", () => {
    const events = [
      { id: "old1", start_time_date: "2000-01-01T00:00:00.000Z" },
      { id: "old2", start_time_date: "2000-06-01T00:00:00.000Z" },
    ];
    // All in the past → returns the last sorted event
    expect(getNextEventId(events)).toBe("old2");
  });

  test("returns first event id when all events have null start_time_date", () => {
    const events = [
      { id: "undated1", start_time_date: null },
      { id: "undated2", start_time_date: null },
    ];
    // No dated events → falls back to events[0].id
    expect(getNextEventId(events)).toBe("undated1");
  });
});

describe("parseCancelCalloutText", () => {
  test("DEFAULT_CANCEL_CALLOUT_TEXT is defined and non-empty", () => {
    expect(typeof DEFAULT_CANCEL_CALLOUT_TEXT).toBe("string");
    expect(DEFAULT_CANCEL_CALLOUT_TEXT.length).toBeGreaterThan(0);
  });

  test("null/undefined uses the default text", () => {
    const result = parseCancelCalloutText(null);
    // Default has brackets, so label should be the bracketed content
    expect(result.label).toBeTruthy();
  });

  test("empty string uses the default text", () => {
    const result = parseCancelCalloutText("");
    expect(result.label).toBeTruthy();
  });

  test("parses prefix, label, suffix from bracketed text", () => {
    const result = parseCancelCalloutText("Can't make it? [Please cancel] so someone else can attend.");
    expect(result.prefix).toBe("Can't make it? ");
    expect(result.label).toBe("Please cancel");
    expect(result.suffix).toBe(" so someone else can attend.");
  });

  test("no brackets: whole text becomes label", () => {
    const result = parseCancelCalloutText("Please cancel your ticket.");
    expect(result.prefix).toBe("");
    expect(result.label).toBe("Please cancel your ticket.");
    expect(result.suffix).toBe("");
  });

  test("only uses the FIRST bracket pair", () => {
    const result = parseCancelCalloutText("[First] and [Second]");
    expect(result.label).toBe("First");
    expect(result.prefix).toBe("");
    expect(result.suffix).toBe(" and [Second]");
  });

  test("bracket at the start: empty prefix", () => {
    const result = parseCancelCalloutText("[Click here] to cancel");
    expect(result.prefix).toBe("");
    expect(result.label).toBe("Click here");
    expect(result.suffix).toBe(" to cancel");
  });

  test("bracket at the end: empty suffix", () => {
    const result = parseCancelCalloutText("To cancel, [click here]");
    expect(result.prefix).toBe("To cancel, ");
    expect(result.label).toBe("click here");
    expect(result.suffix).toBe("");
  });
});
