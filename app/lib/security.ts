export const ALLOWED_REDIRECTS = [
  "/upcoming-speakers",
  "/events",
  "/suggest",
  "/admin",
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
