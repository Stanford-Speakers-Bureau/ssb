import { NextRequest, NextResponse } from "next/server";
import { createSamlClient, mapSamlAttributes } from "@/app/lib/saml";
import { createSessionUser, upsertUserProfile } from "@/app/lib/auth";
import { consumeLoginState, getSession } from "@/app/lib/session";

function buildFailureRedirect(
  baseUrl: string,
  redirectTo: string,
  description?: string,
) {
  const redirectUrl = new URL(redirectTo, baseUrl);
  redirectUrl.searchParams.set("error", "auth_failed");

  if (description) {
    redirectUrl.searchParams.set("error_description", description);
  }

  return NextResponse.redirect(redirectUrl, 303);
}

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const baseUrl = requestUrl.origin;
  let redirectTo = "/";

  try {
    const formData = await request.formData();
    const samlResponse = formData.get("SAMLResponse");
    const relayState = formData.get("RelayState");
    const loginState = await consumeLoginState(relayState);
    redirectTo = loginState?.redirectTo || "/";

    if (!loginState) {
      return buildFailureRedirect(baseUrl, redirectTo, "invalid_login_state");
    }

    if (typeof samlResponse !== "string" || !samlResponse) {
      return buildFailureRedirect(baseUrl, redirectTo);
    }

    const { profile } = await createSamlClient(request).validatePostResponseAsync({
      SAMLResponse: samlResponse,
    });

    if (!profile) {
      return buildFailureRedirect(baseUrl, redirectTo);
    }

    const attrs = mapSamlAttributes(profile as Record<string, unknown>);

    if (!attrs.email || !attrs.displayName) {
      return buildFailureRedirect(baseUrl, redirectTo, "missing_profile_data");
    }

    const user = createSessionUser({
      email: attrs.email,
      uid: attrs.uid,
      displayName: attrs.displayName,
      eduPersonAffiliation: attrs.eduPersonAffiliation,
      eduPersonScopedAffiliation: attrs.eduPersonScopedAffiliation,
    });

    const session = await getSession();
    session.user = user;
    await session.save();
    await upsertUserProfile(user);

    return NextResponse.redirect(new URL(redirectTo, baseUrl), 303);
  } catch (error) {
    console.error("Stanford SSO callback error:", error);
    return buildFailureRedirect(baseUrl, redirectTo);
  }
}
