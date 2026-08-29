export function isValidRedirect(path: string): boolean {
  // Must be a relative path starting with /
  if (!path.startsWith("/")) return false;
  // Prevent protocol-relative URLs (//evil.com)
  if (path.startsWith("//")) return false;
  // Prevent redirects to API routes (avoids loops through auth endpoints)
  if (path.startsWith("/api/")) return false;

  return true;
}
