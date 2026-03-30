const ALLOWED_API_REDIRECT_PREFIXES = [
  "/api/tickets/apple-wallet",
  "/api/tickets/google-wallet",
];

export function isValidRedirect(path: string): boolean {
  // Must be a relative path starting with /
  if (!path.startsWith("/")) return false;
  // Prevent protocol-relative URLs (//evil.com)
  if (path.startsWith("//")) return false;
  // Prevent redirects to auth API routes (avoids loops through auth endpoints)
  if (path === "/api/auth" || path.startsWith("/api/auth/")) return false;
  // Allow-list post-auth wallet routes
  if (ALLOWED_API_REDIRECT_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return true;
  }
  // Disallow other API routes by default
  if (path.startsWith("/api/")) return false;

  return true;
}
