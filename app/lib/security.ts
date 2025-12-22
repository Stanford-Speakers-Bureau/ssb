export const ALLOWED_REDIRECTS = [
  "/api/tickets/apple-wallet",
  "/api/tickets/google-wallet",
  "/upcoming-speakers",
  "/events", // Also covers /events/[eventid] paths (e.g., /events/mark-rober)
  "/suggest",
  "/account",
  "/scan",
  "/",
];

export function isValidRedirect(path: string): boolean {
  // Must be a relative path starting with /
  if (!path.startsWith("/")) return false;
  // Prevent protocol-relative URLs (//evil.com)
  if (path.startsWith("//")) return false;

  // Allow root path
  if (path === "/") return true;

  // Check if path starts with an allowed prefix
  return ALLOWED_REDIRECTS.some(
    (allowed) =>
      path === allowed ||
      path.startsWith(allowed + "?") ||
      path.startsWith(allowed + "/"),
  );
}
