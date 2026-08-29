import { describe, expect, test } from "bun:test";
import {
  isValidUUID,
  isValidEmail,
  normalizeEmail,
  canonicalizeEmail,
  sanitizeString,
} from "../validation";

describe("isValidUUID", () => {
  test("valid UUID lowercase", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  test("valid UUID uppercase", () => {
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  test("invalid: missing hyphens", () => {
    expect(isValidUUID("550e8400e29b41d4a716446655440000")).toBe(false);
  });

  test("invalid: too short", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716")).toBe(false);
  });

  test("invalid: contains non-hex chars", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-44665544000z")).toBe(false);
  });

  test("invalid: empty string", () => {
    expect(isValidUUID("")).toBe(false);
  });
});

describe("isValidEmail", () => {
  test("valid simple email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  test("valid email with subdomain", () => {
    expect(isValidEmail("user@mail.stanford.edu")).toBe(true);
  });

  test("invalid: no @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  test("invalid: no local part", () => {
    expect(isValidEmail("@example.com")).toBe(false);
  });

  test("invalid: space in local part", () => {
    expect(isValidEmail("us er@example.com")).toBe(false);
  });

  test("invalid: no domain TLD", () => {
    expect(isValidEmail("user@example")).toBe(false);
  });

  test("invalid: over 254 chars", () => {
    const long = "a".repeat(250) + "@b.com"; // 250 + 6 = 256 chars
    expect(long.length).toBeGreaterThan(254);
    expect(isValidEmail(long)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  test("trims whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  test("lowercases", () => {
    expect(normalizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com");
  });

  test("trims and lowercases together", () => {
    expect(normalizeEmail("  ALICE@STANFORD.EDU ")).toBe("alice@stanford.edu");
  });
});

describe("canonicalizeEmail", () => {
  test("strips +suffix for all domains", () => {
    expect(canonicalizeEmail("user+tag@example.com")).toBe("user@example.com");
  });

  test("strips +suffix AND dots for gmail.com", () => {
    expect(canonicalizeEmail("a.b.c+tag@gmail.com")).toBe("abc@gmail.com");
  });

  test("strips dots for googlemail.com", () => {
    expect(canonicalizeEmail("a.b.c@googlemail.com")).toBe("abc@googlemail.com");
  });

  test("does NOT strip dots for stanford.edu (Google Workspace exclusion)", () => {
    // stanford.edu uses Google Workspace but is intentionally excluded from dot-stripping
    expect(canonicalizeEmail("a.b@stanford.edu")).toBe("a.b@stanford.edu");
  });

  test("does NOT strip dots for non-gmail/googlemail domains", () => {
    expect(canonicalizeEmail("a.b.c@example.com")).toBe("a.b.c@example.com");
  });

  test("normalizes (trim + lowercase) before canonicalizing", () => {
    expect(canonicalizeEmail("  A.B+tag@GMAIL.COM  ")).toBe("ab@gmail.com");
  });

  test("empty string returns empty string", () => {
    expect(canonicalizeEmail("")).toBe("");
  });

  test("no @ returns the trimmed-lowercase value as-is", () => {
    expect(canonicalizeEmail("notanemail")).toBe("notanemail");
  });
});

describe("sanitizeString", () => {
  test("normal string passes through", () => {
    expect(sanitizeString("Hello, World!")).toBe("Hello, World!");
  });

  test("trims surrounding whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  test("string longer than maxLength returns null", () => {
    expect(sanitizeString("a".repeat(101), 100)).toBeNull();
  });

  test("string exactly at maxLength passes through", () => {
    expect(sanitizeString("a".repeat(100), 100)).toBe("a".repeat(100));
  });

  test("null input returns null", () => {
    expect(sanitizeString(null)).toBeNull();
  });

  test("empty string returns null", () => {
    expect(sanitizeString("")).toBeNull();
  });

  test("whitespace-only returns null (empty after trim)", () => {
    expect(sanitizeString("   ")).toBeNull();
  });

  test("removes control chars (e.g. null byte, bell)", () => {
    const result = sanitizeString("hello\x00world\x07!");
    expect(result).toBe("helloworld!");
  });

  test("preserves tab (\\t) — tab is NOT in the stripped range", () => {
    // \\x09 (tab) is not in the stripped ranges [\\x00-\\x08] or [\\x0E-\\x1F]
    const result = sanitizeString("hello\tworld");
    expect(result).toBe("hello\tworld");
  });

  test("removes DEL char (\\x7F)", () => {
    const result = sanitizeString("hello\x7Fworld");
    expect(result).toBe("helloworld");
  });

  test("newlines (\\n, \\r) pass through — not in stripped range", () => {
    // \\x0A (LF) and \\x0D (CR) are not stripped by sanitizeString
    // (they sit outside the [\\x0E-\\x1F] range; \\x0B/\\x0C are stripped)
    const result = sanitizeString("line1\nline2");
    expect(result).toBe("line1\nline2");
  });
});
