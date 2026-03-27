import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionUser {
  email: string;
  uid: string;
  displayName: string;
  eduPersonAffiliation: string[];
  eduPersonScopedAffiliation: string[];
}

export interface SessionData {
  user?: SessionUser;
}

function getCookieDomain(): string | undefined {
  if (process.env.SESSION_COOKIE_DOMAIN) {
    return process.env.SESSION_COOKIE_DOMAIN;
  }

  if (process.env.NODE_ENV === "production") {
    return ".stanfordspeakersbureau.com";
  }

  return undefined;
}

function getSessionPassword(): string {
  const secret = process.env.SESSION_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET environment variable must be set in production for secure session encryption.",
    );
  }

  return "dev-secret-change-me-in-production-1234";
}

const sessionOptions: SessionOptions = {
  password: getSessionPassword(),
  cookieName: process.env.SESSION_COOKIE_NAME || "ssb_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    ...(getCookieDomain() ? { domain: getCookieDomain() } : {}),
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
