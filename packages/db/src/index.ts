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
// - In Cloudflare Workers: uses the Hyperdrive connection string from the worker context.
//   Hyperdrive manages the actual DB connection pool, so a fresh client per access is fine.
// - Elsewhere (local/SSR): uses DATABASE_URL with a singleton.
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_, prop) {
    const hyperdriveConnStr = getHyperdriveConnectionString();
    if (hyperdriveConnStr) {
      const requestDb = createDb(hyperdriveConnStr, true);
      return (requestDb as unknown as Record<string | symbol, unknown>)[prop];
    }
    console.error("[db] Hyperdrive context not found, falling back to DATABASE_URL");
    if (!globalForDb.db) {
      globalForDb.db = createDb(process.env.DATABASE_URL!);
    }
    return (globalForDb.db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export * from "./schema";
export { sql, eq, ne, and, or, gt, gte, lt, lte, asc, desc, count, inArray, ilike, isNull, isNotNull } from "drizzle-orm";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";