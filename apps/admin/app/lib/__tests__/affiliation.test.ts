import { describe, expect, test } from "bun:test";
import { normalizeAffiliation, getHighestAffiliation } from "../affiliation";

describe("normalizeAffiliation", () => {
  test("lowercases and trims", () => {
    expect(normalizeAffiliation("  Stanford  ")).toBe("stanford");
  });

  test("strips @-suffix (email format)", () => {
    expect(normalizeAffiliation("stanford@stanford.edu")).toBe("stanford");
  });

  test("lowercases before stripping @-suffix", () => {
    expect(normalizeAffiliation("UNDERGRAD@stanford.edu")).toBe("undergrad");
  });

  test("value without @ returns lowercased-trimmed value", () => {
    expect(normalizeAffiliation("Faculty")).toBe("faculty");
  });

  test("empty string returns empty string", () => {
    expect(normalizeAffiliation("")).toBe("");
  });
});

describe("getHighestAffiliation", () => {
  const PRIORITY = ["faculty", "staff", "grad", "undergrad", "alumni"] as const;

  test("returns highest-priority match when multiple values match", () => {
    const result = getHighestAffiliation(
      ["undergrad", "grad", "alumni"],
      PRIORITY,
    );
    expect(result).toBe("grad");
  });

  test("returns single match", () => {
    const result = getHighestAffiliation(["undergrad"], PRIORITY);
    expect(result).toBe("undergrad");
  });

  test("returns first priority item when it matches", () => {
    const result = getHighestAffiliation(
      ["faculty", "staff"],
      PRIORITY,
    );
    expect(result).toBe("faculty");
  });

  test("ignores unknown values", () => {
    const result = getHighestAffiliation(["unknown-value", "grad"], PRIORITY);
    expect(result).toBe("grad");
  });

  test("returns null when no values match the priority list", () => {
    const result = getHighestAffiliation(["community", "visitor"], PRIORITY);
    expect(result).toBeNull();
  });

  test("returns null for empty values array", () => {
    const result = getHighestAffiliation([], PRIORITY);
    expect(result).toBeNull();
  });

  test("returns null for empty priority list", () => {
    const result = getHighestAffiliation(["undergrad"], []);
    expect(result).toBeNull();
  });

  test("normalizes input values before matching (strips email suffix)", () => {
    // normalizeAffiliation strips @-suffix so "grad@stanford.edu" → "grad"
    const result = getHighestAffiliation(
      ["grad@stanford.edu", "alumni@stanford.edu"],
      PRIORITY,
    );
    expect(result).toBe("grad");
  });

  test("normalizes input values before matching (case)", () => {
    const result = getHighestAffiliation(["UNDERGRAD", "ALUMNI"], PRIORITY);
    expect(result).toBe("undergrad");
  });
});
