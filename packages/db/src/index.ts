import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
type CloudflareContext = {
  env?: { HYPERDRIVE?: { connectionString?: string } };
};

const globalForDb = globalThis as unknown as {
  db: DrizzleDb | undefined;
};

const hyperdriveDbs = new WeakMap<
  CloudflareContext,
  { connStr: string; db: DrizzleDb }
>();

// Read the Cloudflare request context directly from the globalThis symbol that
// OpenNext's worker entrypoint always sets -- no require("@opennextjs/cloudflare") needed.
function getCloudflareContext(): CloudflareContext | null {
  return ((globalThis as unknown as Record<symbol, unknown>)[
    Symbol.for("__cloudflare-context__")
  ] ?? null) as CloudflareContext | null;
}

function createDb(connectionString: string, hyperdrive = false): DrizzleDb {
  const client = postgres(connectionString, {
    prepare: false,
    max: hyperdrive ? 5 : 3,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
  });
  return drizzle(client, { schema });
}

// Proxy that lazily resolves the DB on first property access.
// - In Cloudflare Workers: uses the Hyperdrive connection string from the worker context.
//   Hyperdrive manages the actual DB connection pool, so create one client per request.
// - Elsewhere (local/SSR): uses DATABASE_URL with a singleton.
let loggedFallback = false;
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_, prop) {
    const cfCtx = getCloudflareContext();
    if (cfCtx?.env?.HYPERDRIVE?.connectionString) {
      const hyperdriveConnStr = cfCtx.env.HYPERDRIVE.connectionString;
      // Reuse one client for the current request context. Hyperdrive pools
      // origin DB connections, so a fresh driver client per request is cheap
      // and avoids stale cross-request sockets. Caching here only prevents
      // creating a new postgres() pool for every db property access.
      let requestDb = hyperdriveDbs.get(cfCtx);
      if (requestDb?.connStr !== hyperdriveConnStr) {
        requestDb = {
          connStr: hyperdriveConnStr,
          db: createDb(hyperdriveConnStr, true),
        };
        hyperdriveDbs.set(cfCtx, requestDb);
      }
      return (requestDb.db as unknown as Record<string | symbol, unknown>)[
        prop
      ];
    }
    if (!globalForDb.db) {
      if (!loggedFallback) {
        console.error(
          "[db] Hyperdrive context not found, falling back to DATABASE_URL",
        );
        loggedFallback = true;
      }
      globalForDb.db = createDb(process.env.DATABASE_URL!);
    }
    return (globalForDb.db as unknown as Record<string | symbol, unknown>)[
      prop
    ];
  },
});

export * from "./schema";
export * from "./ticketingRoles";
export {
  sql,
  eq,
  ne,
  and,
  or,
  gt,
  gte,
  lt,
  lte,
  asc,
  desc,
  count,
  inArray,
  ilike,
  isNull,
  isNotNull,
} from "drizzle-orm";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";
