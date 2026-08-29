import { sealData } from "iron-session";

import { TEST_SESSION_SECRET } from "../../tests/helpers/env";

export type E2ESessionUser = {
  email: string;
  uid: string;
  displayName: string;
  eduPersonAffiliation: string[];
  eduPersonScopedAffiliation: string[];
};

export const E2E_SESSION_SECRET = TEST_SESSION_SECRET;
export const E2E_SESSION_TTL_SECONDS = 60 * 60 * 8;

export function makeE2EUser(email: string): E2ESessionUser {
  return {
    email,
    uid: email,
    displayName: "Integration Test Admin",
    eduPersonAffiliation: ["staff"],
    eduPersonScopedAffiliation: ["staff@stanford.edu"],
  };
}

export async function forgeSessionCookie(user: E2ESessionUser) {
  const value = await sealData(
    { user },
    { password: E2E_SESSION_SECRET, ttl: E2E_SESSION_TTL_SECONDS },
  );

  return {
    name: process.env.SESSION_COOKIE_NAME || "ssb_session",
    value,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
  };
}
