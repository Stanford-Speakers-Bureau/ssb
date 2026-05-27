/**
 * Validation utilities for security and data integrity
 */

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 max length
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Canonicalize an email for dedup. Mirrors the SQL `canonicalize_email`
 * function in the migrations: strip +suffix for all domains, strip dots from
 * the local part for gmail.com / googlemail.com only. Stanford uses Google
 * Workspace but does NOT honor dot-equivalence, so it's intentionally excluded.
 */
export function canonicalizeEmail(email: string): string {
  const trimmed = normalizeEmail(email);
  if (!trimmed) return "";

  const atPos = trimmed.indexOf("@");
  if (atPos === -1) return trimmed;

  let localPart = trimmed.slice(0, atPos);
  const domain = trimmed.slice(atPos + 1);

  const plusPos = localPart.indexOf("+");
  if (plusPos > 0) {
    localPart = localPart.slice(0, plusPos);
  }

  if (domain === "gmail.com" || domain === "googlemail.com") {
    localPart = localPart.replace(/\./g, "");
  }

  if (!localPart) return trimmed;
  return `${localPart}@${domain}`;
}

export function sanitizeString(
  input: string | null,
  maxLength: number = 10_000,
): string | null {
  if (!input) return null;
  if (input.length > maxLength) return null;
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim() || null;
}
