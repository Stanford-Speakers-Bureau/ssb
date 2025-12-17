/**
 * Generate a referral code from a user's email address.
 * Takes the part before the "@" symbol.
 * Returns null if email is null or undefined.
 *
 * This is a pure utility function that can be used in both Client and Server Components.
 */
export function generateReferralCode(
  email: string | null | undefined,
): string | null {
  if (!email) return null;
  return email.split("@")[0] || null;
}
