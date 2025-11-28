import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../lib/supabase";

// API: GET /api/auth/google
// Initiates Google OAuth sign-in flow via Supabase
// Redirects to Supabase's Google OAuth URL

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const redirectTo = searchParams.get("redirect_to") || "/events/malala";
    
    // Construct base URL
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    const callbackUrl = `${baseUrl}/api/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`;
    
    const supabase = getSupabaseClient();
    
    // Generate the OAuth URL for Google sign-in
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          hd: "stanford.edu",
        },
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data.url) {
      return NextResponse.json(
        { error: "Failed to generate OAuth URL" },
        { status: 500 }
      );
    }

    // Redirect to Google sign-in
    return NextResponse.redirect(data.url);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unexpected server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

