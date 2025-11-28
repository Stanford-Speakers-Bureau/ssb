import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../lib/supabase";

// Allowed redirect paths (must start with /)
const ALLOWED_REDIRECTS = ["/upcoming-speakers", "/events"];

function isValidRedirect(path: string): boolean {
  // Must be a relative path starting with /
  if (!path.startsWith("/")) return false;
  // Prevent protocol-relative URLs (//evil.com)
  if (path.startsWith("//")) return false;
  // Check if path starts with an allowed prefix
  return ALLOWED_REDIRECTS.some(allowed => path === allowed || path.startsWith(allowed + "?") || path.startsWith(allowed + "/"));
}

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

  // Validate redirect path to prevent open redirect attacks
  const safeRedirect = isValidRedirect(redirectTo) ? redirectTo : "/upcoming-speakers";

  return NextResponse.redirect(new URL(safeRedirect, baseUrl));
}

