import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const redirectTo = searchParams.get("redirect_to") || "/upcoming-speakers";
  
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = req.headers.get("host") || "localhost:3000";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
  
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${baseUrl}/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
        hd: "stanford.edu",
      },
    },
  });

  if (error || !data.url) {
    return NextResponse.json(
      { error: error?.message || "Failed to initiate sign in" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.url);
}
