import { describe, expect, test } from "bun:test";
import {
  isValidUUID,
  isValidEmail,
  normalizeEmail,
  canonicalizeEmail,
  hasUnsafeHeaderChars,
  isValidUrl,
  isValidRoute,
  isValidCapacity,
  isValidImageExtension,
  isValidAppleWalletImageExtension,
  isValidImageSize,
  isValidDateString,
  isValidLatitude,
  isValidLongitude,
  isValidAddress,
  sanitizeString,
} from "../validation";

describe("isValidUUID", () => {
  test("valid UUID", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  test("valid UUID uppercase", () => {
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  test("invalid: no hyphens", () => {
    expect(isValidUUID("550e8400e29b41d4a716446655440000")).toBe(false);
  });

  test("invalid: empty string", () => {
    expect(isValidUUID("")).toBe(false);
  });
});

describe("isValidEmail", () => {
  test("valid email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  test("invalid: no @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  test("invalid: over 254 chars", () => {
    const long = "a".repeat(250) + "@b.com";
    expect(isValidEmail(long)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  ALICE@EXAMPLE.COM  ")).toBe("alice@example.com");
  });
});

describe("canonicalizeEmail", () => {
  test("strips +suffix for all domains", () => {
    expect(canonicalizeEmail("user+tag@example.com")).toBe("user@example.com");
  });

  test("strips dots for gmail.com", () => {
    expect(canonicalizeEmail("a.b.c+tag@gmail.com")).toBe("abc@gmail.com");
  });

  test("strips dots for googlemail.com", () => {
    expect(canonicalizeEmail("a.b@googlemail.com")).toBe("ab@googlemail.com");
  });

  test("does NOT strip dots for stanford.edu", () => {
    expect(canonicalizeEmail("a.b@stanford.edu")).toBe("a.b@stanford.edu");
  });

  test("empty string returns empty", () => {
    expect(canonicalizeEmail("")).toBe("");
  });
});

describe("hasUnsafeHeaderChars — email header injection guard", () => {
  test("plain string is safe", () => {
    expect(hasUnsafeHeaderChars("Hello World")).toBe(false);
  });

  test("empty string is safe", () => {
    expect(hasUnsafeHeaderChars("")).toBe(false);
  });

  test("CR (\\r) is unsafe", () => {
    expect(hasUnsafeHeaderChars("Subject\rBcc: evil@example.com")).toBe(true);
  });

  test("LF (\\n) is unsafe", () => {
    expect(hasUnsafeHeaderChars("value\nX-Injected: header")).toBe(true);
  });

  test("CRLF (\\r\\n) is unsafe", () => {
    expect(hasUnsafeHeaderChars("value\r\nX-Injected: header")).toBe(true);
  });

  test("string with only CR returns true", () => {
    expect(hasUnsafeHeaderChars("\r")).toBe(true);
  });

  test("string with only LF returns true", () => {
    expect(hasUnsafeHeaderChars("\n")).toBe(true);
  });

  test("normal email address is safe", () => {
    expect(hasUnsafeHeaderChars("Alice <alice@example.com>")).toBe(false);
  });

  test("normal display name with special chars is safe", () => {
    expect(hasUnsafeHeaderChars("O'Brien, Pat")).toBe(false);
  });
});

describe("isValidUrl", () => {
  test("https URL is valid", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });

  test("http URL is valid", () => {
    expect(isValidUrl("http://example.com/path?q=1")).toBe(true);
  });

  test("empty string is invalid", () => {
    expect(isValidUrl("")).toBe(false);
  });

  test("relative URL is invalid", () => {
    expect(isValidUrl("/relative/path")).toBe(false);
  });

  test("ftp:// is invalid (not http/https)", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });

  test("not-a-url is invalid", () => {
    expect(isValidUrl("not a url")).toBe(false);
  });

  test("URL over 2048 chars is invalid", () => {
    const long = "https://example.com/" + "a".repeat(2030);
    expect(long.length).toBeGreaterThan(2048);
    expect(isValidUrl(long)).toBe(false);
  });
});

describe("isValidRoute", () => {
  test("null is valid (allowed)", () => {
    expect(isValidRoute(null)).toBe(true);
  });

  test("alphanumeric slug is valid", () => {
    expect(isValidRoute("my-event-2024")).toBe(true);
  });

  test("underscore is valid", () => {
    expect(isValidRoute("my_event")).toBe(true);
  });

  test("uppercase letters are invalid", () => {
    expect(isValidRoute("MyEvent")).toBe(false);
  });

  test("spaces are invalid", () => {
    expect(isValidRoute("my event")).toBe(false);
  });

  test("route over 100 chars is invalid", () => {
    expect(isValidRoute("a".repeat(101))).toBe(false);
  });

  test("exactly 100 chars is valid", () => {
    expect(isValidRoute("a".repeat(100))).toBe(true);
  });
});

describe("isValidCapacity", () => {
  test("null is valid", () => {
    expect(isValidCapacity(null)).toBe(true);
  });

  test("zero is valid", () => {
    expect(isValidCapacity("0")).toBe(true);
  });

  test("positive integer is valid", () => {
    expect(isValidCapacity("250")).toBe(true);
  });

  test("negative number is invalid", () => {
    expect(isValidCapacity("-1")).toBe(false);
  });

  test("non-numeric string is invalid", () => {
    expect(isValidCapacity("abc")).toBe(false);
  });

  test("over 100000 is invalid", () => {
    expect(isValidCapacity("100001")).toBe(false);
  });

  test("100000 is valid (boundary)", () => {
    expect(isValidCapacity("100000")).toBe(true);
  });
});

describe("isValidImageExtension", () => {
  test("jpg is valid", () => {
    expect(isValidImageExtension("photo.jpg")).toBe(true);
  });

  test("jpeg is valid", () => {
    expect(isValidImageExtension("photo.jpeg")).toBe(true);
  });

  test("png is valid", () => {
    expect(isValidImageExtension("photo.png")).toBe(true);
  });

  test("gif is valid", () => {
    expect(isValidImageExtension("photo.gif")).toBe(true);
  });

  test("webp is valid", () => {
    expect(isValidImageExtension("photo.webp")).toBe(true);
  });

  test("pdf is invalid", () => {
    expect(isValidImageExtension("doc.pdf")).toBe(false);
  });

  test("no extension is invalid", () => {
    expect(isValidImageExtension("nodotfile")).toBe(false);
  });

  test("extension is case-insensitive", () => {
    expect(isValidImageExtension("photo.PNG")).toBe(true);
    expect(isValidImageExtension("photo.JPG")).toBe(true);
  });
});

describe("isValidAppleWalletImageExtension", () => {
  test("png is valid", () => {
    expect(isValidAppleWalletImageExtension("logo.png")).toBe(true);
  });

  test("jpg is invalid (Apple Wallet only allows png)", () => {
    expect(isValidAppleWalletImageExtension("logo.jpg")).toBe(false);
  });

  test("PNG (uppercase) is valid", () => {
    expect(isValidAppleWalletImageExtension("logo.PNG")).toBe(true);
  });
});

describe("isValidImageSize", () => {
  test("1 byte is valid", () => {
    expect(isValidImageSize(1)).toBe(true);
  });

  test("5MB is valid (boundary)", () => {
    expect(isValidImageSize(5 * 1024 * 1024)).toBe(true);
  });

  test("5MB + 1 byte is invalid", () => {
    expect(isValidImageSize(5 * 1024 * 1024 + 1)).toBe(false);
  });

  test("0 bytes is invalid", () => {
    expect(isValidImageSize(0)).toBe(false);
  });

  test("negative size is invalid", () => {
    expect(isValidImageSize(-1)).toBe(false);
  });
});

describe("isValidDateString", () => {
  test("null is valid", () => {
    expect(isValidDateString(null)).toBe(true);
  });

  test("ISO 8601 string is valid", () => {
    expect(isValidDateString("2024-06-15T18:00:00.000Z")).toBe(true);
  });

  test("date-only string is valid", () => {
    expect(isValidDateString("2024-06-15")).toBe(true);
  });

  test("garbage string is invalid", () => {
    expect(isValidDateString("not-a-date")).toBe(false);
  });
});

describe("isValidLatitude", () => {
  test("null is valid", () => {
    expect(isValidLatitude(null)).toBe(true);
  });

  test("0 is valid", () => {
    expect(isValidLatitude("0")).toBe(true);
  });

  test("90 is valid (boundary)", () => {
    expect(isValidLatitude("90")).toBe(true);
  });

  test("-90 is valid (boundary)", () => {
    expect(isValidLatitude("-90")).toBe(true);
  });

  test("91 is invalid", () => {
    expect(isValidLatitude("91")).toBe(false);
  });

  test("-91 is invalid", () => {
    expect(isValidLatitude("-91")).toBe(false);
  });

  test("non-numeric is invalid", () => {
    expect(isValidLatitude("north")).toBe(false);
  });
});

describe("isValidLongitude", () => {
  test("null is valid", () => {
    expect(isValidLongitude(null)).toBe(true);
  });

  test("180 is valid (boundary)", () => {
    expect(isValidLongitude("180")).toBe(true);
  });

  test("-180 is valid (boundary)", () => {
    expect(isValidLongitude("-180")).toBe(true);
  });

  test("181 is invalid", () => {
    expect(isValidLongitude("181")).toBe(false);
  });
});

describe("isValidAddress", () => {
  test("null is valid", () => {
    expect(isValidAddress(null)).toBe(true);
  });

  test("normal address is valid", () => {
    expect(isValidAddress("450 Serra Mall, Stanford, CA 94305")).toBe(true);
  });

  test("address over 500 chars is invalid", () => {
    expect(isValidAddress("a".repeat(501))).toBe(false);
  });

  test("exactly 500 chars is valid", () => {
    expect(isValidAddress("a".repeat(500))).toBe(true);
  });
});

describe("sanitizeString", () => {
  test("normal string passes through", () => {
    expect(sanitizeString("Hello, World!")).toBe("Hello, World!");
  });

  test("trims surrounding whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  test("null returns null", () => {
    expect(sanitizeString(null)).toBeNull();
  });

  test("empty string returns null", () => {
    expect(sanitizeString("")).toBeNull();
  });

  test("string over maxLength returns null", () => {
    expect(sanitizeString("a".repeat(10001))).toBeNull();
  });

  test("removes control chars (null byte)", () => {
    expect(sanitizeString("hello\x00world")).toBe("helloworld");
  });

  test("removes DEL char", () => {
    expect(sanitizeString("hello\x7Fworld")).toBe("helloworld");
  });

  test("newlines pass through (not in stripped range)", () => {
    expect(sanitizeString("line1\nline2")).toBe("line1\nline2");
  });
});
