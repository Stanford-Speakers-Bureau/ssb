import { NextResponse } from "next/server";
import { createSamlClient } from "@/app/lib/saml";
import { isValidRedirect } from "@/app/lib/security";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const redirectToParam =
    searchParams.get("redirect_to") || "/upcoming-speakers";
  const redirectTo = isValidRedirect(redirectToParam)
    ? redirectToParam
    : "/upcoming-speakers";

  try {
    const url = await createSamlClient(req).getAuthorizeUrlAsync(
      redirectTo,
      undefined,
      {},
    );
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Stanford SSO login error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Stanford sign in" },
      { status: 500 },
    );
  }
}
