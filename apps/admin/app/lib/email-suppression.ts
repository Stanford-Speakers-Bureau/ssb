import { and, auditLogs, db, inArray, roles, sql } from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";

/**
 * Batch lookup for the `email_suppression` role. Returns the set of
 * normalized (lowercase, trimmed) addresses that are hard-blocked.
 *
 * The single-row variant `isEmailSuppressed` lives in `email.ts` and is used
 * inside `sendRawEmailViaSES` as a per-send safety net. This batch version
 * lets the mass-send routes partition recipients up front so they can:
 *   - skip the per-send DB query for every recipient, and
 *   - surface a `suppressed` count in the API response + audit metadata.
 */
export async function getSuppressedSet(
  emails: string[],
): Promise<Set<string>> {
  const normalized = [
    ...new Set(
      emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0),
    ),
  ];
  if (normalized.length === 0) return new Set();

  const rows = await db
    .select({ email: roles.email, roles: roles.roles })
    .from(roles)
    .where(inArray(roles.email, normalized));

  const suppressed = new Set<string>();
  for (const row of rows) {
    if (!row.email || !row.roles) continue;
    const has = row.roles
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .includes("email_suppression");
    if (has) suppressed.add(row.email.trim().toLowerCase());
  }
  return suppressed;
}

export type Partitioned = {
  sendable: string[];
  suppressed: string[];
};

export async function partitionBySuppression(
  emails: string[],
): Promise<Partitioned> {
  const set = await getSuppressedSet(emails);
  const sendable: string[] = [];
  const suppressed: string[] = [];
  for (const email of emails) {
    if (set.has(email.trim().toLowerCase())) suppressed.push(email);
    else sendable.push(email);
  }
  return { sendable, suppressed };
}

/**
 * Extract a short, loggable string from whatever a failed Promise rejected
 * with. Keeps the audit metadata bounded.
 */
function describeError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message?.trim() || err.name || "Unknown error";
    return msg.length > 500 ? msg.slice(0, 500) : msg;
  }
  if (typeof err === "string") {
    return err.length > 500 ? err.slice(0, 500) : err;
  }
  try {
    const str = JSON.stringify(err);
    return str.length > 500 ? str.slice(0, 500) : str;
  } catch {
    return "Unknown error";
  }
}

/**
 * Write one `email.send_failed` audit row per recipient that errored during
 * a mass send. All rows share the same batchId so an admin can filter the
 * audit log by batchId to see every failure in one view.
 *
 * Opt-out skips and email-suppression skips are NOT logged here — those are
 * known categories surfaced as counts on the aggregate audit row. Only
 * actual sendAttempt errors land here.
 */
export async function logSendFailures(opts: {
  failures: Array<{ email: string; error: unknown }>;
  actor: string;
  source: string;
  batchId: string | null;
  eventId?: string | null;
  eventName?: string | null;
  extraMetadata?: Record<string, unknown>;
}): Promise<void> {
  if (opts.failures.length === 0) return;

  await Promise.all(
    opts.failures.map((f) =>
      logAuditEvent({
        action: "email.send_failed",
        actor: opts.actor,
        eventId: opts.eventId ?? null,
        eventName: opts.eventName ?? null,
        targetEmail: f.email,
        metadata: {
          source: opts.source,
          batchId: opts.batchId,
          error: describeError(f.error),
          ...opts.extraMetadata,
        },
      })
    ),
  );
}

const SUPPRESSION_ROLE = "email_suppression";

/**
 * Adds the `email_suppression` role to each address (creating the roles row
 * if needed) and writes one `user.add_role` audit row per newly suppressed
 * address. Addresses that are already suppressed are skipped silently, so
 * repeated bounces for the same address are harmless.
 *
 * Returns the addresses that were newly suppressed.
 */
export async function addEmailSuppressions(opts: {
  entries: Array<{ email: string; metadata?: Record<string, unknown> }>;
  actor: string;
}): Promise<string[]> {
  const byEmail = new Map<string, Record<string, unknown> | undefined>();
  for (const entry of opts.entries) {
    const email = entry.email.trim().toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, entry.metadata);
  }
  const emails = [...byEmail.keys()];
  if (emails.length === 0) return [];

  const existing = await db
    .select({ email: roles.email, roles: roles.roles })
    .from(roles)
    .where(inArray(roles.email, emails));

  const existingEmails = new Set<string>();
  const toUpdate: string[] = [];
  for (const row of existing) {
    if (!row.email) continue;
    existingEmails.add(row.email);
    const current = (row.roles ?? "")
      .split(",")
      .map((r) => r.trim().toLowerCase());
    if (!current.includes(SUPPRESSION_ROLE)) toUpdate.push(row.email);
  }
  const toInsert = emails.filter((e) => !existingEmails.has(e));

  const added: string[] = [];
  if (toUpdate.length > 0) {
    // The NOT ANY guard keeps this idempotent if two notifications for the
    // same address race each other.
    const rows = await db
      .update(roles)
      .set({
        roles: sql`array_to_string(array_append(array_remove(string_to_array(coalesce(${roles.roles}, ''), ','), ''), ${SUPPRESSION_ROLE}), ',')`,
      })
      .where(
        and(
          inArray(roles.email, toUpdate),
          sql`not (${SUPPRESSION_ROLE} = any(string_to_array(coalesce(${roles.roles}, ''), ',')))`,
        ),
      )
      .returning({ email: roles.email });
    for (const r of rows) if (r.email) added.push(r.email);
  }
  if (toInsert.length > 0) {
    const rows = await db
      .insert(roles)
      .values(toInsert.map((email) => ({ email, roles: SUPPRESSION_ROLE })))
      .returning({ email: roles.email });
    for (const r of rows) if (r.email) added.push(r.email);
  }

  if (added.length > 0) {
    try {
      await db.insert(auditLogs).values(
        added.map((email) => ({
          action: "user.add_role",
          actor: opts.actor,
          source: "admin",
          targetEmail: email,
          metadata: JSON.stringify({
            role: SUPPRESSION_ROLE,
            ...byEmail.get(email),
          }),
        })),
      );
    } catch (err) {
      console.error("[email-suppression] Failed to write audit rows:", err);
    }
  }

  return added;
}
