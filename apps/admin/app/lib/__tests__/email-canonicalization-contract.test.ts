import { describe, expect, test } from "bun:test";
import { canonicalizeEmail, normalizeEmail } from "../validation";

const normalizationCases: Array<[string, string]> = [
  ["  USER@EXAMPLE.COM  ", "user@example.com"],
  ["A.B+Tag@STANFORD.EDU", "a.b+tag@stanford.edu"],
  ["  NotAnEmail  ", "notanemail"],
];

const canonicalizationCases: Array<[string, string]> = [
  ["  USER@EXAMPLE.COM  ", "user@example.com"],
  ["user+tag@example.com", "user@example.com"],
  ["a.b.c+tag@gmail.com", "abc@gmail.com"],
  ["a.b.c@googlemail.com", "abc@googlemail.com"],
  ["A.B+Tag@STANFORD.EDU", "a.b@stanford.edu"],
  ["a.b@stanford.edu", "a.b@stanford.edu"],
  ["a.b.c@example.com", "a.b.c@example.com"],
  ["+tag@example.com", "+tag@example.com"],
  ["notanemail", "notanemail"],
  ["", ""],
];

describe("email canonicalization contract", () => {
  test.each(normalizationCases)("normalizes %p as %p", (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  test.each(canonicalizationCases)(
    "canonicalizes %p as %p",
    (input, expected) => {
      expect(canonicalizeEmail(input)).toBe(expected);
    },
  );
});
