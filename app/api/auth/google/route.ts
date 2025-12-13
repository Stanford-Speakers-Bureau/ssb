import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase";
import { isValidRedirect } from "../../../lib/security";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const redirectToParam =
    searchParams.get("redirect_to") || "/upcoming-speakers";

  // Validate redirect path to prevent open redirect attacks
  const redirectTo = isValidRedirect(redirectToParam)
    ? redirectToParam
    : "/upcoming-speakers";

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const origin = new URL(req.url).origin;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || origin || `${protocol}://${req.headers.get("host") || "localhost:3000"}`;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${baseUrl}/callback/auth?redirect_to=${encodeURIComponent(redirectTo)}`,
      queryParams: {
        access_type: "online",
        prompt: "none",
        hd: "stanford.edu",
      },
    },
  });

  if (error || !data.url) {
    return NextResponse.json(
      { error: error?.message || "Failed to initiate sign in" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(data.url);
}
