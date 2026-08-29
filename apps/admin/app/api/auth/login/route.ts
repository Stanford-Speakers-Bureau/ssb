import { NextResponse } from "next/server";
import { createSamlClient } from "@/app/lib/saml";
import { isValidRedirect } from "@/app/lib/security";
import { createLoginState, storeLoginState } from "@/app/lib/session";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const redirectToParam = searchParams.get("redirect_to") || "/";
  const redirectTo = isValidRedirect(redirectToParam) ? redirectToParam : "/";

  try {
    const loginState = createLoginState(redirectTo);
    await storeLoginState(loginState);

    const url = await createSamlClient(req).getAuthorizeUrlAsync(
      loginState.nonce,
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
