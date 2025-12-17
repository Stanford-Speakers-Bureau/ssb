import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase";
import { isValidRedirect } from "@/app/lib/security";

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
      // Parse the redirect URL to preserve existing query parameters
      const redirectUrl = new URL(safeRedirect, baseUrl);
      redirectUrl.searchParams.set("error", "auth_failed");
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Parse the redirect URL to ensure query parameters are preserved
  const redirectUrl = new URL(safeRedirect, baseUrl);
  return NextResponse.redirect(redirectUrl);
}
