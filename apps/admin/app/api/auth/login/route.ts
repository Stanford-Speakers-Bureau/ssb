import { NextResponse } from "next/server";
import { createSamlClient } from "@/app/lib/saml";
import { isValidRedirect } from "@/app/lib/security";
import {
  createLoginState,
  getSession,
  storeLoginState,
} from "@/app/lib/session";
import { createSessionUser } from "@/app/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const redirectToParam = searchParams.get("redirect_to") || "/";
  const redirectTo = isValidRedirect(redirectToParam) ? redirectToParam : "/";

  // Local dev only: Stanford SSO can't return to localhost, so sign in
  // directly as DEV_AUTH_EMAIL instead.
  const devEmail = process.env.DEV_AUTH_EMAIL;
  if (process.env.NODE_ENV === "development" && devEmail) {
    const session = await getSession();
    session.user = createSessionUser({
      email: devEmail,
      displayName: process.env.DEV_AUTH_NAME || devEmail.split("@")[0],
      eduPersonAffiliation: ["student"],
      eduPersonScopedAffiliation: ["student@stanford.edu"],
    });
    await session.save();
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

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
