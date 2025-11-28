import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../lib/supabase";

// API: GET /api/auth/callback
// Handles OAuth callback from Google sign-in, saves session to cookie

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const redirectTo = searchParams.get("redirect_to") || "/admin";
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Construct base URL for redirects
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

    // Handle OAuth errors
    if (error) {
      const errorUrl = new URL(redirectTo, baseUrl);
      errorUrl.searchParams.set("error", error);
      errorUrl.searchParams.set(
        "error_message",
        errorDescription || "Authentication failed"
      );
      return NextResponse.redirect(errorUrl.toString());
    }

    if (!code) {
      const errorUrl = new URL(redirectTo, baseUrl);
      errorUrl.searchParams.set("error", "no_code");
      errorUrl.searchParams.set(
        "error_message",
        "No authorization code provided. Please try signing in again."
      );
      return NextResponse.redirect(errorUrl.toString());
    }

    const supabase = getSupabaseClient();

    // Exchange the code for a session
    const { data: authData, error: authError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (authError || !authData.session) {
      const errorUrl = new URL(redirectTo, baseUrl);
      errorUrl.searchParams.set("error", "auth_failed");
      errorUrl.searchParams.set(
        "error_message",
        authError?.message || "Failed to authenticate"
      );
      return NextResponse.redirect(errorUrl.toString());
    }

    const { session } = authData;

    // Create response with redirect
    const successUrl = new URL(redirectTo, baseUrl);
    const response = NextResponse.redirect(successUrl.toString());

    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: session.expires_in,
    };

    // Save session tokens in cookies
    response.cookies.set("sb-access-token", session.access_token, cookieOptions);
    response.cookies.set("sb-refresh-token", session.refresh_token, cookieOptions);

    return response;
  } catch (e: unknown) {
    const errorMessage =
      e instanceof Error ? e.message : "Unexpected server error";
    const { searchParams } = new URL(req.url);
    const redirectTo = searchParams.get("redirect_to") || "/admin";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    const errorUrl = new URL(redirectTo, baseUrl);
    errorUrl.searchParams.set("error", "server_error");
    errorUrl.searchParams.set("error_message", errorMessage);
    return NextResponse.redirect(errorUrl.toString());
  }
}
