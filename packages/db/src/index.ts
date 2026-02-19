import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

function createDb() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  return drizzle(client, { schema });
}

export const db: ReturnType<typeof drizzle<typeof schema>> =
  globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export * from "./schema";
export { sql, eq, ne, and, or, gt, gte, lt, lte, asc, desc, count, inArray, ilike, isNull, isNotNull } from "drizzle-orm";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";
