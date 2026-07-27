export const LOCAL_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const TEST_SESSION_SECRET = "ssb-e2e-session-secret-0123456789-abcdef";

export function normalizeTestEnv(): void {
  // Bun automatically loads .env. Tests must never inherit production services.
  process.env.DATABASE_URL = LOCAL_TEST_DATABASE_URL;
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  process.env.SESSION_COOKIE_NAME = "ssb_session";
  process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3100";
  process.env.AWS_ACCESS_KEY_ID = "test-access-key";
  process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.AWS_REGION = "us-west-2";
  process.env.SES_FROM_EMAIL = "tickets@example.test";
  process.env.DISABLE_EMAIL = "true";
}

export function assertLocalDatabaseUrl(
  databaseUrl = process.env.DATABASE_URL,
): URL {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database-backed tests");
  }

  const parsed = new URL(databaseUrl);
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const explicitOverride = process.env.I_KNOW_THIS_DB;

  if (
    !allowedHosts.has(parsed.hostname) &&
    explicitOverride !== parsed.hostname
  ) {
    throw new Error(
      `Refusing to write to non-local database host ${parsed.hostname}. ` +
        "Set I_KNOW_THIS_DB to that exact hostname only for an intentional test database.",
    );
  }

  return parsed;
}
