import { NextRequest, NextResponse } from "next/server";
import { createSamlClient, mapSamlAttributes } from "@/app/lib/saml";
import { createSessionUser, upsertUserProfile } from "@/app/lib/auth";
import { getSession } from "@/app/lib/session";
import { isValidRedirect } from "@/app/lib/security";

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const baseUrl = requestUrl.origin;

  try {
    const formData = await request.formData();
    const samlResponse = formData.get("SAMLResponse");
    const relayState = formData.get("RelayState");
    const redirectTo =
      typeof relayState === "string" && isValidRedirect(relayState)
        ? relayState
        : "/upcoming-speakers";

    if (typeof samlResponse !== "string" || !samlResponse) {
      const redirectUrl = new URL(redirectTo, baseUrl);
      redirectUrl.searchParams.set("error", "auth_failed");
      return NextResponse.redirect(redirectUrl, 303);
    }

    const { profile } = await createSamlClient(request).validatePostResponseAsync({
      SAMLResponse: samlResponse,
    });

    if (!profile) {
      const redirectUrl = new URL(redirectTo, baseUrl);
      redirectUrl.searchParams.set("error", "auth_failed");
      return NextResponse.redirect(redirectUrl, 303);
    }

    const attrs = mapSamlAttributes(profile as Record<string, unknown>);

    if (!attrs.email || !attrs.displayName) {
      const redirectUrl = new URL(redirectTo, baseUrl);
      redirectUrl.searchParams.set("error", "auth_failed");
      redirectUrl.searchParams.set("error_description", "missing_profile_data");
      return NextResponse.redirect(redirectUrl, 303);
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
    const redirectUrl = new URL("/upcoming-speakers", baseUrl);
    redirectUrl.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(redirectUrl, 303);
  }
}
