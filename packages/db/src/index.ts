import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  db: DrizzleDb | undefined;
};

function getConnectionString(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const { env } = getCloudflareContext();
    const hyperdrive = (env as Record<string, unknown>)
      ?.HYPERDRIVE as { connectionString?: string } | undefined;
    if (hyperdrive?.connectionString) {
      return hyperdrive.connectionString;
    }
  } catch {
    // Not in a CF request context or package unavailable — fall through
  }
  return process.env.DATABASE_URL!;
}

function createDb(): DrizzleDb {
  const client = postgres(getConnectionString(), { prepare: false });
  return drizzle(client, { schema });
}

// Proxy that lazily creates the DB on first use.
// Deferring until request-time ensures the Cloudflare context (and therefore
// the Hyperdrive binding) is available when getConnectionString() is called.
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_, prop) {
    if (!globalForDb.db) {
      globalForDb.db = createDb();
    }
    return (globalForDb.db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export * from "./schema";
export { sql, eq, ne, and, or, gt, gte, lt, lte, asc, desc, count, inArray, ilike, isNull, isNotNull } from "drizzle-orm";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";
