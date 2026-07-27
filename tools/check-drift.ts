import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const adminRoot = join(webRoot, "..", "admin");
const knownAdminOnlyTables = new Set(["permissionGrants", "emailCampaigns"]);

async function exists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

function schemaShape(source: string): Map<string, string[]> {
  const starts = [...source.matchAll(/export const (\w+) = pgTable\(/g)];
  const result = new Map<string, string[]>();

  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index];
    const end = starts[index + 1]?.index ?? source.length;
    const block = source.slice(match.index, end);
    const columns = [...block.matchAll(/\w+:\s*\w+\("([^"]+)"/g)]
      .map((column) => column[1])
      .sort();
    result.set(match[1], columns);
  }

  return result;
}

async function checkSchema(): Promise<string[]> {
  const web = schemaShape(
    await Bun.file(join(webRoot, "packages/db/src/schema.ts")).text(),
  );
  const admin = schemaShape(
    await Bun.file(join(adminRoot, "packages/db/src/schema.ts")).text(),
  );
  const errors: string[] = [];
  const allTables = new Set([...web.keys(), ...admin.keys()]);

  for (const table of allTables) {
    if (knownAdminOnlyTables.has(table)) continue;
    const webColumns = web.get(table);
    const adminColumns = admin.get(table);
    if (!webColumns || !adminColumns) {
      errors.push(`schema table ${table} exists in only one repository`);
    } else if (webColumns.join("\0") !== adminColumns.join("\0")) {
      errors.push(`schema columns differ for ${table}`);
    }
  }

  return errors;
}

async function checkMigrations(): Promise<string[]> {
  const webDir = join(webRoot, "supabase/migrations");
  const adminDir = join(adminRoot, "supabase/migrations");
  const webFiles = (await readdir(webDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const adminFiles = (await readdir(adminDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const errors: string[] = [];

  if (webFiles.join("\0") !== adminFiles.join("\0")) {
    errors.push("migration filename sets differ");
  }

  for (const file of webFiles.filter((name) => adminFiles.includes(name))) {
    const [webText, adminText] = await Promise.all([
      Bun.file(join(webDir, file)).text(),
      Bun.file(join(adminDir, file)).text(),
    ]);
    if (webText !== adminText)
      errors.push(`migration content differs: ${file}`);
  }

  return errors;
}

async function checkUnsubscribeWireFormat(): Promise<string[]> {
  process.env.SESSION_SECRET = "cross-app-contract-secret-0123456789";
  const adminLinks = await import(
    pathToFileURL(join(adminRoot, "app/lib/unsubscribe-links.ts")).href
  );
  const webLinks = await import(
    pathToFileURL(join(webRoot, "app/lib/unsubscribe-links.ts")).href
  );
  const eventId = "00000000-0000-4000-8000-000000000008";
  const link = await adminLinks.buildEventUnsubscribeLink({
    baseUrl: "https://example.test",
    email: " Contract.User@Stanford.edu ",
    eventId,
  });
  const token = new URL(link).searchParams.get("token");
  const claims = token ? await webLinks.verifyUnsubscribeToken(token) : null;

  return claims?.scope === "event" &&
    claims.email === "contract.user@stanford.edu" &&
    claims.eventId === eventId
    ? []
    : ["admin-generated unsubscribe token failed web verification"];
}

if (!(await exists(join(adminRoot, "package.json")))) {
  console.log("check-drift: skipped (../admin is not present)");
  process.exit(0);
}

const errors = [
  ...(await checkSchema()),
  ...(await checkMigrations()),
  ...(await checkUnsubscribeWireFormat()),
];

if (errors.length) {
  for (const error of errors) console.error(`check-drift: ${error}`);
  process.exit(1);
}

console.log(
  "check-drift: schemas, migrations, and unsubscribe wire format agree",
);
