import { NextResponse } from "next/server";
import { clearSession } from "@/app/lib/auth";
import { isValidRedirect } from "@/app/lib/security";

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const redirectTo = requestUrl.searchParams.get("redirect_to") || "/";
  const baseUrl = requestUrl.origin;

  const safeRedirect = isValidRedirect(redirectTo) ? redirectTo : "/";

  await clearSession();

  return NextResponse.redirect(new URL(safeRedirect, baseUrl));
}
