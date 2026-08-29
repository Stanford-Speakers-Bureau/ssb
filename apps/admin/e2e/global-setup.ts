import postgres from "postgres";

import {
  assertLocalDatabaseUrl,
  LOCAL_TEST_DATABASE_URL,
} from "../tests/helpers/env";

export default async function globalSetup(): Promise<void> {
  const databaseUrl = assertLocalDatabaseUrl(
    process.env.DATABASE_URL || LOCAL_TEST_DATABASE_URL,
  ).toString();
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 5 });
  try {
    await sql`select 1`;
  } catch (error) {
    throw new Error(
      "E2E database is unavailable. Run `supabase db start` and `supabase db reset` first.",
      { cause: error },
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
  await fetch("http://localhost:3101").catch(() => undefined);
}
