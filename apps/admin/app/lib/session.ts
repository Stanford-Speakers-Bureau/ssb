import { randomUUID } from "crypto";
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

export interface LoginState {
  nonce: string;
  redirectTo: string;
  createdAt: number;
}

interface LoginFlowData {
  loginStates?: LoginState[];
  samlRequestIds?: Record<string, string>;
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

function getSessionCookieName(): string {
  return process.env.SESSION_COOKIE_NAME || "ssb_session";
}

function getLoginFlowCookieName(): string {
  if (process.env.LOGIN_FLOW_COOKIE_NAME) {
    return process.env.LOGIN_FLOW_COOKIE_NAME;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_ROOT_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "";

  if (!appUrl) {
    return `${getSessionCookieName()}_sso_flow`;
  }

  try {
    const suffix = new URL(appUrl).host.replace(/[^a-z0-9]+/gi, "_");
    return `${getSessionCookieName()}_${suffix}_sso_flow`;
  } catch {
    return `${getSessionCookieName()}_sso_flow`;
  }
}

function isSecureCookieEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.SESSION_COOKIE_SECURE === "true"
  );
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

export const SAML_REQUEST_STATE_TTL_MS = 10 * 60 * 1000;

const sessionOptions: SessionOptions = {
  password: getSessionPassword(),
  cookieName: getSessionCookieName(),
  cookieOptions: {
    secure: isSecureCookieEnabled(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    ...(getCookieDomain() ? { domain: getCookieDomain() } : {}),
  },
};

const loginFlowSessionOptions: SessionOptions = {
  password: getSessionPassword(),
  cookieName: getLoginFlowCookieName(),
  cookieOptions: {
    secure: isSecureCookieEnabled(),
    httpOnly: true,
    sameSite: isSecureCookieEnabled() ? "none" : "lax",
    path: "/",
    maxAge: Math.ceil(SAML_REQUEST_STATE_TTL_MS / 1000),
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

async function getLoginFlowSession(): Promise<IronSession<LoginFlowData>> {
  const cookieStore = await cookies();
  return getIronSession<LoginFlowData>(cookieStore, loginFlowSessionOptions);
}

function pruneLoginStates(loginStates: LoginState[] | undefined): LoginState[] {
  const now = Date.now();

  return (loginStates || [])
    .filter((state) => now - state.createdAt < SAML_REQUEST_STATE_TTL_MS)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
}

function parseSamlRequestCreatedAt(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pruneSamlRequestIds(
  samlRequestIds: Record<string, string> | undefined,
): Record<string, string> {
  const now = Date.now();

  return Object.fromEntries(
    Object.entries(samlRequestIds || {})
      .filter(([, createdAt]) => {
        const parsedCreatedAt = parseSamlRequestCreatedAt(createdAt);
        return parsedCreatedAt > 0 && now - parsedCreatedAt < SAML_REQUEST_STATE_TTL_MS;
      })
      .sort((a, b) => parseSamlRequestCreatedAt(b[1]) - parseSamlRequestCreatedAt(a[1]))
      .slice(0, 10),
  );
}

async function persistLoginFlowSession(
  session: IronSession<LoginFlowData>,
): Promise<void> {
  session.loginStates = pruneLoginStates(session.loginStates);
  session.samlRequestIds = pruneSamlRequestIds(session.samlRequestIds);

  const hasLoginStates = (session.loginStates?.length ?? 0) > 0;
  const hasSamlRequestIds = Object.keys(session.samlRequestIds || {}).length > 0;

  if (!hasLoginStates && !hasSamlRequestIds) {
    session.destroy();
    return;
  }

  await session.save();
}

export function createLoginState(redirectTo: string): LoginState {
  return {
    nonce: randomUUID(),
    redirectTo,
    createdAt: Date.now(),
  };
}

export async function storeLoginState(loginState: LoginState): Promise<void> {
  const session = await getLoginFlowSession();
  const existingStates = pruneLoginStates(session.loginStates).filter(
    (state) => state.nonce !== loginState.nonce,
  );

  session.loginStates = [loginState, ...existingStates].slice(0, 5);
  await persistLoginFlowSession(session);
}

export async function consumeLoginState(
  relayState: FormDataEntryValue | null,
): Promise<LoginState | null> {
  const session = await getLoginFlowSession();
  const loginStates = pruneLoginStates(session.loginStates);

  let matchedState: LoginState | null = null;
  if (typeof relayState === "string" && relayState) {
    const nextStates: LoginState[] = [];

    for (const state of loginStates) {
      if (!matchedState && state.nonce === relayState) {
        matchedState = state;
        continue;
      }

      nextStates.push(state);
    }

    session.loginStates = nextStates;
  } else {
    session.loginStates = loginStates;
  }

  await persistLoginFlowSession(session);
  return matchedState;
}

export async function saveSamlRequestId(
  requestId: string,
  value: string,
): Promise<{ value: string; createdAt: number } | null> {
  const session = await getLoginFlowSession();
  const samlRequestIds = pruneSamlRequestIds(session.samlRequestIds);

  samlRequestIds[requestId] = value;
  session.samlRequestIds = samlRequestIds;
  await persistLoginFlowSession(session);

  return {
    value,
    createdAt: parseSamlRequestCreatedAt(value) || Date.now(),
  };
}

export async function getSamlRequestId(requestId: string): Promise<string | null> {
  const session = await getLoginFlowSession();
  const samlRequestIds = pruneSamlRequestIds(session.samlRequestIds);
  const value = samlRequestIds[requestId] || null;

  session.samlRequestIds = samlRequestIds;
  await persistLoginFlowSession(session);

  return value;
}

export async function removeSamlRequestId(
  requestId: string | null,
): Promise<string | null> {
  if (!requestId) {
    return null;
  }

  const session = await getLoginFlowSession();
  const samlRequestIds = pruneSamlRequestIds(session.samlRequestIds);
  const value = samlRequestIds[requestId] || null;

  delete samlRequestIds[requestId];
  session.samlRequestIds = samlRequestIds;
  await persistLoginFlowSession(session);

  return value;
}
