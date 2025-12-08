import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../lib/supabase";

// Allowed redirect paths (must start with /)
const ALLOWED_REDIRECTS = [
  "/upcoming-speakers",
  "/events",
  "/suggest",
  "/admin",
];

function isValidRedirect(path: string): boolean {
  // Must be a relative path starting with /
  if (!path.startsWith("/")) return false;
  // Prevent protocol-relative URLs (//evil.com)
  if (path.startsWith("//")) return false;
  // Check if path starts with an allowed prefix
  return ALLOWED_REDIRECTS.some(
    (allowed) =>
      path === allowed ||
      path.startsWith(allowed + "?") ||
      path.startsWith(allowed + "/"),
  );
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo =
    requestUrl.searchParams.get("redirect_to") || "/upcoming-speakers";

  // Validate redirect path to prevent open redirect attacks
  const safeRedirect = isValidRedirect(redirectTo)
    ? redirectTo
    : "/upcoming-speakers";

  // Use the request origin to ensure we redirect back to the same domain
  const baseUrl = requestUrl.origin;

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Log the error for debugging purposes (optional, could be more robust)
      console.error("Supabase auth exchangeCodeForSession error:", error);
      // Redirect to the safeRedirect with an error parameter
      return NextResponse.redirect(
        new URL(`${safeRedirect}?error=auth_failed`, baseUrl),
      );
    }
  }

  return NextResponse.redirect(new URL(safeRedirect, baseUrl));
}
