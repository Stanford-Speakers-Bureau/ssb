import { db, eq, inArray, roles, userProfiles } from "@ssb/db";
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

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseRoleNames(rawRoles: string | null | undefined): string[] {
  return (rawRoles ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function hasRoleName(
  rawRoles: string | null | undefined,
  roleName: string,
): boolean {
  return parseRoleNames(rawRoles).includes(roleName.trim().toLowerCase());
}

export async function getFeeWaiverEmailSetForEmails(
  emails: string[],
): Promise<Set<string>> {
  const normalizedEmails = [...new Set(
    emails.map((email) => normalizeEmail(email)).filter(Boolean),
  )];

  if (normalizedEmails.length === 0) {
    return new Set();
  }

  const roleRows = await db.query.roles.findMany({
    where: inArray(roles.email, normalizedEmails),
    columns: {
      email: true,
      roles: true,
    },
  });

  return new Set(
    roleRows
      .filter((row) => hasRoleName(row.roles, "fee_waiver"))
      .map((row) => (row.email ? normalizeEmail(row.email) : ""))
      .filter(Boolean),
  );
}

export async function hasFeeWaiverForEmail(email: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  const feeWaiverEmails = await getFeeWaiverEmailSetForEmails([normalizedEmail]);
  return feeWaiverEmails.has(normalizedEmail);
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

export async function getRoleNamesForEmail(email: string): Promise<string[]> {
  const roleRecords = await db.query.roles.findMany({
    where: eq(roles.email, normalizeEmail(email)),
    columns: { roles: true },
  });

  return [...new Set(roleRecords.flatMap((roleRecord) => parseRoleNames(roleRecord.roles)))];
}

export async function verifyAdminRequest(): Promise<AdminVerificationResult> {
  const user = await getSessionUser();

  if (!user?.email) {
    return { authorized: false, error: "Not authenticated" };
  }

  const userRoles = await getRoleNamesForEmail(user.email);

  if (!userRoles.includes("admin")) {
    return { authorized: false, error: "Not authorized" };
  }

  return {
    authorized: true,
    email: user.email,
    adminClient: getSupabaseClient(),
  };
}
