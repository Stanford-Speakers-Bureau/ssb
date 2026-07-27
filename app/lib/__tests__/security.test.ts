import { describe, expect, test } from "bun:test";
import { isValidRedirect } from "../security";

describe("isValidRedirect", () => {
  test("/account is valid", () => {
    expect(isValidRedirect("/account")).toBe(true);
  });

  test("https://evil.com is invalid (not relative)", () => {
    expect(isValidRedirect("https://evil.com")).toBe(false);
  });

  test("//evil.com is invalid (protocol-relative)", () => {
    expect(isValidRedirect("//evil.com")).toBe(false);
  });

  test("/api/auth/login is invalid", () => {
    expect(isValidRedirect("/api/auth/login")).toBe(false);
  });

  test("/api/tickets/apple-wallet?x=1 is valid", () => {
    expect(isValidRedirect("/api/tickets/apple-wallet?x=1")).toBe(true);
  });

  test("/api/anything is invalid", () => {
    expect(isValidRedirect("/api/anything")).toBe(false);
  });

  test("empty string is invalid", () => {
    expect(isValidRedirect("")).toBe(false);
  });
});
