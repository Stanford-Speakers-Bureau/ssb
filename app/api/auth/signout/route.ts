import {NextResponse} from "next/server";
import {createServerSupabaseClient} from "@/app/lib/supabase";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const redirectTo = requestUrl.searchParams.get("redirect_to") || "/";
  const baseUrl = requestUrl.origin;

  const supabase = await createServerSupabaseClient();

  // Sign out with global scope to clear all sessions
  const { error } = await supabase.auth.signOut({ scope: "global" });

  if (error) {
    console.error("Sign out error:", error);
    // Still redirect even on error to ensure user can navigate
  }

  return NextResponse.redirect(new URL(redirectTo, baseUrl));
}
