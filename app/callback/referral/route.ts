import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidRedirect } from "../../lib/security";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const referral = requestUrl.searchParams.get("referral");
  const redirectTo =
    requestUrl.searchParams.get("redirect_to") || "/upcoming-speakers";

  // Validate redirect path to prevent open redirect attacks
  const safeRedirect = isValidRedirect(redirectTo)
    ? redirectTo
    : "/upcoming-speakers";

  // Use the request origin to ensure we redirect back to the same domain
  const baseUrl = requestUrl.origin;

  // Store referral in cookie if provided
  if (referral) {
    const cookieStore = await cookies();
    cookieStore.set("referral", referral, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }

  return NextResponse.redirect(new URL(safeRedirect, baseUrl));
}
