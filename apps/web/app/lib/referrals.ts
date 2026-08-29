import { and, db, eq, referrals } from "@ssb/db";
import { generateReferralCode } from "./utils";

export const REFERRAL_VALIDATION_MESSAGES = {
  DISABLED: "Referrals are not enabled for this event",
  INVALID: "Invalid referral code for this event",
  SELF_REFERRAL: "You cannot use your own referral code",
} as const;

type ReferralValidationReason = "disabled" | "invalid" | "self_referral";

type ReferralValidationSuccess = {
  ok: true;
  referral: string | null;
};

type ReferralValidationFailure = {
  ok: false;
  referral: null;
  message: string;
  reason: ReferralValidationReason;
};

type ValidateReferralInputArgs = {
  eventId: string;
  referralCode: string | null | undefined;
  userEmail: string;
  referralsEnabled: boolean;
  disabledBehavior?: "ignore" | "reject";
};

export function normalizeReferralCode(
  referralCode: string | null | undefined,
): string | null {
  const normalized = referralCode?.trim().toLowerCase() || null;
  return normalized || null;
}

export async function validateReferralInput(
  args: ValidateReferralInputArgs,
): Promise<ReferralValidationSuccess | ReferralValidationFailure> {
  const {
    eventId,
    referralCode,
    userEmail,
    referralsEnabled,
    disabledBehavior = "ignore",
  } = args;

  const normalizedReferral = normalizeReferralCode(referralCode);
  if (!normalizedReferral) {
    return { ok: true, referral: null };
  }

  if (!referralsEnabled) {
    if (disabledBehavior === "reject") {
      return {
        ok: false,
        referral: null,
        message: REFERRAL_VALIDATION_MESSAGES.DISABLED,
        reason: "disabled",
      };
    }

    return { ok: true, referral: null };
  }

  const userReferralCode = normalizeReferralCode(
    generateReferralCode(userEmail),
  );
  if (normalizedReferral === userReferralCode) {
    return {
      ok: false,
      referral: null,
      message: REFERRAL_VALIDATION_MESSAGES.SELF_REFERRAL,
      reason: "self_referral",
    };
  }

  const referralRecord = await db.query.referrals.findFirst({
    where: and(
      eq(referrals.eventId, eventId),
      eq(referrals.referralCode, normalizedReferral),
    ),
    columns: { id: true },
  });

  if (!referralRecord) {
    return {
      ok: false,
      referral: null,
      message: REFERRAL_VALIDATION_MESSAGES.INVALID,
      reason: "invalid",
    };
  }

  return { ok: true, referral: normalizedReferral };
}

export async function sanitizeStoredReferral(
  args: Omit<ValidateReferralInputArgs, "disabledBehavior">,
): Promise<string | null> {
  const validation = await validateReferralInput({
    ...args,
    disabledBehavior: "ignore",
  });

  return validation.ok ? validation.referral : null;
}
