import {
  TEST_SAML_SP_PRIVATE_KEY,
  TEST_SAML_SP_PUBLIC_CERT,
} from "./test-saml-keys";

export const LOCAL_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const TEST_SESSION_SECRET = "ssb-e2e-session-secret-0123456789-abcdef";

// Fake service credentials so tests are hermetic in CI, where no .env exists.
// These satisfy client construction / signing only; nothing reaches a real
// external service (email is disabled, Supabase queries go through Drizzle).
export const TEST_SUPABASE_URL = "http://127.0.0.1:54321";
export const TEST_SUPABASE_KEY = "ssb-e2e-supabase-key";
export const TEST_APPLE_WALLET_SECRET = "ssb-e2e-apple-wallet-secret";
export const TEST_SAML_SP_ENTITY_ID = "https://ssb-admin.test/saml/metadata";
export { TEST_SAML_SP_PRIVATE_KEY, TEST_SAML_SP_PUBLIC_CERT };

export function normalizeTestEnv(): void {
  process.env.DATABASE_URL = LOCAL_TEST_DATABASE_URL;
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  process.env.SESSION_COOKIE_NAME = "ssb_session";
  process.env.NEXT_PUBLIC_ROOT_URL = "http://localhost:3101";
  process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3101";
  process.env.AWS_ACCESS_KEY_ID = "test-access-key";
  process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.AWS_REGION = "us-west-2";
  process.env.SES_FROM_EMAIL = "tickets@example.test";
  process.env.DISABLE_EMAIL = "true";
  process.env.SUPABASE_URL = TEST_SUPABASE_URL;
  process.env.SUPABASE_KEY = TEST_SUPABASE_KEY;
  process.env.APPLE_WALLET_SECRET = TEST_APPLE_WALLET_SECRET;
  process.env.SAML_SP_ENTITY_ID = TEST_SAML_SP_ENTITY_ID;
  process.env.SP_PRIVATE_KEY = TEST_SAML_SP_PRIVATE_KEY;
  process.env.SP_PUBLIC_CERT = TEST_SAML_SP_PUBLIC_CERT;
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
