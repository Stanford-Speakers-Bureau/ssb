import { describe, expect, test } from "bun:test";
import { generateReferralCode, generateGoogleCalendarUrl } from "../utils";
import { CALENDAR_DEFAULT_DURATION_MS } from "../constants";

describe("generateReferralCode", () => {
  test("extracts local part of email", () => {
    expect(generateReferralCode("alice@example.com")).toBe("alice");
  });

  test("lowercases the local part", () => {
    expect(generateReferralCode("Alice@Example.com")).toBe("alice");
  });

  test("returns null for null input", () => {
    expect(generateReferralCode(null)).toBeNull();
  });

  test("returns null for undefined input", () => {
    expect(generateReferralCode(undefined)).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(generateReferralCode("")).toBeNull();
  });
});

describe("generateGoogleCalendarUrl", () => {
  const START = "2024-06-15T18:00:00.000Z";
  const END = "2024-06-15T20:00:00.000Z";

  test("returns empty string when startTime is missing", () => {
    expect(generateGoogleCalendarUrl({ name: "Test" })).toBe("");
  });

  test("returns empty string when startTime is invalid", () => {
    expect(generateGoogleCalendarUrl({ start_time_date: "not-a-date" })).toBe("");
  });

  test("returns Google Calendar URL host", () => {
    const url = generateGoogleCalendarUrl({ start_time_date: START, end_time_date: END });
    expect(url).toContain("https://calendar.google.com/calendar/render");
  });

  test("URL contains action=TEMPLATE", () => {
    const url = generateGoogleCalendarUrl({ start_time_date: START });
    expect(url).toContain("action=TEMPLATE");
  });

  test("URL contains dates query param", () => {
    const url = generateGoogleCalendarUrl({ start_time_date: START, end_time_date: END });
    expect(url).toContain("dates=");
  });

  test("uses default duration when no end time", () => {
    const url = generateGoogleCalendarUrl({ start_time_date: START });
    const parsed = new URL(url);
    const datesParam = parsed.searchParams.get("dates")!;
    expect(datesParam).toBeTruthy();
    // Dates are formatted as "START/END" — split on "/"
    const [startStr, endStr] = datesParam.split("/");

    // Parse back the UTC timestamps from the format "20240615T180000Z"
    const parseGoogleDate = (s: string): Date => {
      // "20240615T180000Z" -> "2024-06-15T18:00:00Z"
      return new Date(
        `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`,
      );
    };

    const startDate = parseGoogleDate(startStr);
    const endDate = parseGoogleDate(endStr);
    const actualDurationMs = endDate.getTime() - startDate.getTime();
    expect(actualDurationMs).toBe(CALENDAR_DEFAULT_DURATION_MS);
  });

  test("uses provided endTime over default duration", () => {
    const url = generateGoogleCalendarUrl({ start_time_date: START, end_time_date: END });
    const parsed = new URL(url);
    const datesParam = parsed.searchParams.get("dates")!;
    const [, endStr] = datesParam.split("/");

    // END is 2024-06-15T20:00:00.000Z → "20240615T200000Z"
    expect(endStr).toBe("20240615T200000Z");
  });

  test("URL contains encoded event name in text param", () => {
    const url = generateGoogleCalendarUrl({ start_time_date: START, name: "Test Speaker" });
    // encodeURIComponent uses %20 not +
    expect(decodeURIComponent(url)).toContain("Stanford Speakers Bureau");
    expect(decodeURIComponent(url)).toContain("Test Speaker");
  });

  test("supports ticket email fields (eventStartTime, eventEndTime)", () => {
    const url = generateGoogleCalendarUrl({
      eventStartTime: START,
      eventEndTime: END,
      eventName: "Ticket Event",
    });
    expect(url).toContain("https://calendar.google.com/calendar/render");
    expect(decodeURIComponent(url)).toContain("Ticket Event");
  });

  test("uses route to build event URL in details", () => {
    const url = generateGoogleCalendarUrl({
      start_time_date: START,
      name: "My Event",
      route: "my-event",
    });
    expect(decodeURIComponent(url)).toContain("/events/my-event");
  });

  test("empty string when start_time_date is falsy", () => {
    expect(generateGoogleCalendarUrl({ start_time_date: null })).toBe("");
    expect(generateGoogleCalendarUrl({ start_time_date: "" })).toBe("");
  });
});
