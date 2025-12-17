import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase";
import { isValidRedirect } from "@/app/lib/security";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const redirectToParam =
    searchParams.get("redirect_to") || "/upcoming-speakers";
  const forcePrompt = searchParams.get("force_prompt") === "true";

  // Validate redirect path to prevent open redirect attacks
  const redirectTo = isValidRedirect(redirectToParam)
    ? redirectToParam
    : "/upcoming-speakers";

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const origin = new URL(req.url).origin;
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    origin ||
    `${protocol}://${req.headers.get("host") || "localhost:3000"}`;

  const supabase = await createServerSupabaseClient();

  // Build query params - skip prompt: "none" if force_prompt is set (retry after interaction_required)
  const queryParams: Record<string, string> = {
    access_type: "online",
    hd: "stanford.edu",
  };

  // Only use prompt: "none" if not forcing a prompt (i.e., not retrying after interaction_required)
  if (!forcePrompt) {
    queryParams.prompt = "none";
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${baseUrl}/callback/auth?redirect_to=${encodeURIComponent(redirectTo)}`,
      queryParams,
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
