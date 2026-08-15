import { describe, expect, it } from "bun:test";

import {
  REFERRAL_VALIDATION_MESSAGES,
  normalizeReferralCode,
  validateReferralInput,
} from "../referrals";
import { generateReferralCode } from "../utils";

describe("referral input", () => {
  it("normalizes whitespace, casing, and empty values", () => {
    expect(normalizeReferralCode("  AbC-123  ")).toBe("abc-123");
    expect(normalizeReferralCode("   ")).toBeNull();
    expect(normalizeReferralCode(undefined)).toBeNull();
  });

  it("ignores a supplied code when referrals are disabled by default", async () => {
    await expect(
      validateReferralInput({
        eventId: "event-1",
        referralCode: "some-code",
        userEmail: "person@example.test",
        referralsEnabled: false,
      }),
    ).resolves.toEqual({ ok: true, referral: null });
  });

  it("can reject a code when referrals are disabled", async () => {
    await expect(
      validateReferralInput({
        eventId: "event-1",
        referralCode: "some-code",
        userEmail: "person@example.test",
        referralsEnabled: false,
        disabledBehavior: "reject",
      }),
    ).resolves.toEqual({
      ok: false,
      referral: null,
      message: REFERRAL_VALIDATION_MESSAGES.DISABLED,
      reason: "disabled",
    });
  });

  it("rejects a user's own referral code without querying storage", async () => {
    const email = "Person@Example.test";
    await expect(
      validateReferralInput({
        eventId: "event-1",
        referralCode: `  ${generateReferralCode(email)!.toUpperCase()}  `,
        userEmail: email,
        referralsEnabled: true,
      }),
    ).resolves.toMatchObject({
      ok: false,
      message: REFERRAL_VALIDATION_MESSAGES.SELF_REFERRAL,
      reason: "self_referral",
    });
  });
});
