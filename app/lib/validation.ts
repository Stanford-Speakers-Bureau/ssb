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

export function sanitizeString(
  input: string | null,
  maxLength: number = 10_000,
): string | null {
  if (!input) return null;
  if (input.length > maxLength) return null;
  return (
    input
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim() || null
  );
}
