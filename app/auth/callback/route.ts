import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect_to") || "/upcoming-speakers";
  
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = req.headers.get("host") || "localhost:3000";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(redirectTo, baseUrl));
}

