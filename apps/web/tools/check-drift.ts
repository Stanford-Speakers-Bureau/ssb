// Cross-app contract check: admin mints signed unsubscribe links into
// outgoing emails; web verifies them. The two implementations live in
// each app's app/lib until that code is unified, so round-trip a token
// here to catch wire-format drift.
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const adminRoot = join(webRoot, "..", "admin");

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

const errors = await checkUnsubscribeWireFormat();

if (errors.length) {
  for (const error of errors) console.error(`check-drift: ${error}`);
  process.exit(1);
}

console.log("check-drift: unsubscribe wire format agrees across apps");
