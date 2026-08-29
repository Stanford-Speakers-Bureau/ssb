import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  db: DrizzleDb | undefined;
};

// Read the Hyperdrive connection string directly from the globalThis symbol that
// OpenNext's worker entrypoint always sets — no require("@opennextjs/cloudflare") needed.
function getHyperdriveConnectionString(): string | null {
  const cfCtx = (globalThis as unknown as Record<symbol, unknown>)[
    Symbol.for("__cloudflare-context__")
  ] as { env?: { HYPERDRIVE?: { connectionString?: string } } } | undefined;
  return cfCtx?.env?.HYPERDRIVE?.connectionString ?? null;
}

function createDb(connectionString: string, hyperdrive = false): DrizzleDb {
  const client = postgres(connectionString, {
    prepare: false,
    max: hyperdrive ? 5 : 10,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

// Proxy that lazily resolves the DB on first property access.
// - Local dev: uses DATABASE_URL from .env as a singleton.
// - Production (Cloudflare Workers): uses Hyperdrive connection string.
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_, prop) {
    // Local dev: use DATABASE_URL from .env as a singleton
    if (process.env.DATABASE_URL) {
      if (!globalForDb.db) {
        globalForDb.db = createDb(process.env.DATABASE_URL);
      }
      return (globalForDb.db as unknown as Record<string | symbol, unknown>)[prop];
    }
    // Production (Cloudflare Workers): use Hyperdrive
    const hyperdriveConnStr = getHyperdriveConnectionString();
    if (hyperdriveConnStr) {
      const requestDb = createDb(hyperdriveConnStr, true);
      return (requestDb as unknown as Record<string | symbol, unknown>)[prop];
    }
    throw new Error("No DATABASE_URL or Hyperdrive connection available");
  },
});

export * from "./schema";
export * from "./ticketingRoles";
export { sql, eq, ne, and, or, gt, gte, lt, lte, asc, desc, count, inArray, ilike, isNull, isNotNull } from "drizzle-orm";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";
