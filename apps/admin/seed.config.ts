import { SeedPostgres } from "@snaplet/seed/adapter-postgres";
import { defineConfig } from "@snaplet/seed/config";
import postgres from "postgres";

const seedDatabaseUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export default defineConfig({
  adapter: () => {
    const client = postgres(seedDatabaseUrl);
    return new SeedPostgres(client);
  },
  select: [
    "!auth.*",
    "!storage.*",
    "!realtime.*",
    "!extensions.*",
    "!supabase_functions.*",
    "!_realtime.*",
    "!supabase_migrations.*",
    "!pgsodium.*",
    "!pgsodium_masks.*",
    "!vault.*",
    "!net.*",
    "!_analytics.*",
  ],
});
