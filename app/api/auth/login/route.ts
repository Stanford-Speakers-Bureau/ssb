import { NextResponse } from "next/server";
import { createSamlClient } from "@/app/lib/saml";
import { isValidRedirect } from "@/app/lib/security";
import { createLoginState, getSession } from "@/app/lib/session";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const redirectToParam =
    searchParams.get("redirect_to") || "/upcoming-speakers";
  const redirectTo = isValidRedirect(redirectToParam)
    ? redirectToParam
    : "/upcoming-speakers";

  try {
    const session = await getSession();
    const loginState = createLoginState(redirectTo);
    session.loginState = loginState;
    await session.save();

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
