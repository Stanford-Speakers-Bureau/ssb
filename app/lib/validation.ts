/**
 * Validation utilities for security and data integrity
 */

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 max length
}

/**
 * Validate URL format and ensure it's HTTP/HTTPS
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.length > 2048) return false; // Max URL length
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate route slug (alphanumeric, hyphens, underscores only)
 */
export function isValidRoute(route: string | null): boolean {
  if (!route) return true; // null is allowed
  if (route.length > 100) return false;
  const routeRegex = /^[a-z0-9_-]+$/;
  return routeRegex.test(route);
}

/**
 * Validate capacity (non-negative integer)
 */
export function isValidCapacity(capacity: string | null): boolean {
  if (!capacity) return true; // null/empty defaults to 0
  const num = parseInt(capacity, 10);
  return !isNaN(num) && num >= 0 && num <= 100000; // Reasonable max
}

/**
 * Validate file extension for images
 */
const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];

export function isValidImageExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? ALLOWED_IMAGE_EXTENSIONS.includes(ext) : false;
}

/**
 * Validate file size (max 5MB for images)
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export function isValidImageSize(size: number): boolean {
  return size > 0 && size <= MAX_IMAGE_SIZE;
}

/**
 * Validate date string format (ISO 8601)
 */
export function isValidDateString(dateString: string | null): boolean {
  if (!dateString) return true; // null is allowed
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Sanitize string input (remove control characters, limit length)
 */
export function sanitizeString(
  input: string | null,
  maxLength: number = 10000,
): string | null {
  if (!input) return null;
  if (input.length > maxLength) return null;
  return (
    input
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars
      .trim() || null
  );
}
