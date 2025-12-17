import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase";
import { isValidRedirect } from "@/app/lib/security";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const redirectTo =
    requestUrl.searchParams.get("redirect_to") || "/upcoming-speakers";

  // Validate redirect path to prevent open redirect attacks
  const safeRedirect = isValidRedirect(redirectTo)
    ? redirectTo
    : "/upcoming-speakers";

  // Use the request origin to ensure we redirect back to the same domain
  const baseUrl = requestUrl.origin;

  // Handle OAuth errors from the provider
  if (error) {
    console.error("OAuth error:", error, errorDescription);

    // For interaction_required, retry OAuth without prompt: "none"
    if (error === "interaction_required") {
      const authUrl = new URL("/api/auth/google", baseUrl);
      authUrl.searchParams.set("redirect_to", redirectTo);
      authUrl.searchParams.set("force_prompt", "true"); // Flag to skip prompt: "none"
      return NextResponse.redirect(authUrl);
    }

    // For other errors, redirect with error message
    const redirectUrl = new URL(safeRedirect, baseUrl);
    redirectUrl.searchParams.set("error", "auth_failed");
    if (errorDescription) {
      redirectUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

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
