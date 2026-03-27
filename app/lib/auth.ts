import { db, eq, roles, userProfiles } from "@ssb/db";
import { getSession, type SessionUser } from "./session";
import { getSupabaseClient } from "./supabase";

type UnauthorizedResult = {
  authorized: false;
  error: string;
};

type AuthorizedResult = {
  authorized: true;
  email: string;
  adminClient: ReturnType<typeof getSupabaseClient>;
};

export type AdminVerificationResult = UnauthorizedResult | AuthorizedResult;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeAffiliations(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export function createSessionUser(input: {
  email: string;
  uid?: string;
  displayName: string;
  eduPersonAffiliation: string[];
  eduPersonScopedAffiliation: string[];
}): SessionUser {
  const email = normalizeEmail(input.email);

  return {
    email,
    uid: input.uid?.trim() || email.split("@")[0],
    displayName: input.displayName.trim(),
    eduPersonAffiliation: normalizeAffiliations(input.eduPersonAffiliation),
    eduPersonScopedAffiliation: normalizeAffiliations(
      input.eduPersonScopedAffiliation,
    ),
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.user || null;
}

export async function clearSession() {
  const session = await getSession();
  session.destroy();
}

export async function upsertUserProfile(user: SessionUser) {
  const now = new Date();

  await db.insert(userProfiles)
    .values({
      email: normalizeEmail(user.email),
      uid: user.uid,
      displayName: user.displayName,
      eduPersonAffiliation: normalizeAffiliations(user.eduPersonAffiliation),
      eduPersonScopedAffiliation: normalizeAffiliations(
        user.eduPersonScopedAffiliation,
      ),
      lastSignInAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userProfiles.email,
      set: {
        uid: user.uid,
        displayName: user.displayName,
        eduPersonAffiliation: normalizeAffiliations(user.eduPersonAffiliation),
        eduPersonScopedAffiliation: normalizeAffiliations(
          user.eduPersonScopedAffiliation,
        ),
        lastSignInAt: now,
        updatedAt: now,
      },
    });
}

export async function getUserProfileByEmail(email: string) {
  return db.query.userProfiles.findFirst({
    where: eq(userProfiles.email, normalizeEmail(email)),
  });
}

export async function getDisplayNameForEmail(email: string): Promise<string | null> {
  const profile = await getUserProfileByEmail(email);
  return profile?.displayName || null;
}

export async function verifyAdminOrScannerRequest(): Promise<AdminVerificationResult> {
  const user = await getSessionUser();

  if (!user?.email) {
    return { authorized: false, error: "Not authenticated" };
  }

  const roleRecord = await db.query.roles.findFirst({
    where: eq(roles.email, user.email),
    columns: { roles: true },
  });

  if (!roleRecord) {
    return { authorized: false, error: "Not authorized" };
  }

  const userRoles = roleRecord.roles?.split(",") || [];
  const isAdmin = userRoles.includes("admin");
  const isScanner = userRoles.includes("scanner");

  if (!isAdmin && !isScanner) {
    return { authorized: false, error: "Not authorized" };
  }

  return {
    authorized: true,
    email: user.email,
    adminClient: getSupabaseClient(),
  };
}
