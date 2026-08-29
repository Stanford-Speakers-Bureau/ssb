import {
  and,
  db,
  emailUnsubscribes,
  eq,
  isNull,
  mailingList,
  sql,
} from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";
import { canonicalizeEmail } from "@/app/lib/validation";

export type UnsubscribeScope = "announce" | "event" | "newsletter";

export type UnsubscribeRecord = {
  id: string;
  email: string;
  scope: UnsubscribeScope;
  eventId: string | null;
  source: string;
  reason: string | null;
  actor: string;
  createdAt: string;
};

export function isUnsubscribeScope(value: unknown): value is UnsubscribeScope {
  return value === "announce" || value === "event" || value === "newsletter";
}

export type FilterResult = {
  kept: string[];
  skipped: string[];
};

export type MailingListSource =
  | "backfill"
  | "login"
  | "ticket"
  | "ticket_admin"
  | "waitlist"
  | "notify"
  | "suggest"
  | "vote"
  | "manual";

/**
 * Add (or refresh) a mailing list member. Idempotent — repeats just bump
 * updated_at. On first insert, writes a `mailing_list.subscribe` audit row.
 *
 * @param opts.actor — who triggered the add. Defaults to the canonical email
 *   itself (self-action). For admin-driven adds, pass the admin's email.
 */
export async function recordMailingListMember(opts: {
  email: string;
  source: MailingListSource;
  actor?: string;
}): Promise<void> {
  const display = opts.email.trim();
  const canonical = canonicalizeEmail(opts.email);
  if (!canonical || !canonical.includes("@")) return;

  try {
    const inserted = await db
      .insert(mailingList)
      .values({
        email: canonical,
        displayEmail: display,
        source: opts.source,
      })
      .onConflictDoNothing()
      .returning({ id: mailingList.id });

    if (inserted.length > 0) {
      await logAuditEvent({
        action: "mailing_list.subscribe",
        actor: opts.actor ?? canonical,
        targetEmail: canonical,
        metadata: {
          source: opts.source,
          displayEmail: display,
        },
      });
    } else {
      await db
        .update(mailingList)
        .set({ updatedAt: new Date() })
        .where(eq(mailingList.email, canonical));
    }
  } catch (err) {
    console.error("[mailing-list] failed to record member:", err);
  }
}

export async function isUnsubscribed(
  email: string,
  scope: UnsubscribeScope,
  eventId?: string | null,
): Promise<boolean> {
  const normalized = canonicalizeEmail(email);
  if (!normalized) return false;

  if (scope === "announce" || scope === "newsletter") {
    const row = await db.query.emailUnsubscribes.findFirst({
      where: and(
        eq(emailUnsubscribes.email, normalized),
        eq(emailUnsubscribes.scope, scope),
        isNull(emailUnsubscribes.eventId),
      ),
      columns: { id: true },
    });
    return !!row;
  }

  if (!eventId) return false;
  const row = await db.query.emailUnsubscribes.findFirst({
    where: and(
      eq(emailUnsubscribes.email, normalized),
      eq(emailUnsubscribes.scope, "event"),
      eq(emailUnsubscribes.eventId, eventId),
    ),
    columns: { id: true },
  });
  return !!row;
}

/**
 * Hierarchical filter for promotional event emails.
 *
 * Per-recipient rule:
 *  - If the recipient already holds a ticket for this event → only their
 *    event-scope opt-out can block the send (announce opt-out does NOT block,
 *    so they keep getting reminders for the ticket they got).
 *  - If they don't hold a ticket → either an event-scope OR an announce-scope
 *    opt-out blocks the send. Announce opt-out is the "stop all promotional
 *    marketing" switch.
 *
 * Transactional emails (ticket confirmation, cancellation, waitlist
 * confirmation, scan notifications) should NOT call this — they bypass
 * opt-outs entirely.
 */
export async function filterUnsubscribedHierarchical(
  emails: string[],
  eventId: string,
): Promise<FilterResult> {
  const normalized = [
    ...new Set(
      emails
        .map((e) => canonicalizeEmail(e))
        .filter((e) => e.length > 0),
    ),
  ];

  if (normalized.length === 0) return { kept: [], skipped: [] };

  const rows = await db.execute<{
    email: string;
    has_ticket: boolean;
    event_opted: boolean;
    announce_opted: boolean;
  }>(sql`
    WITH input(email) AS (
      VALUES ${sql.join(normalized.map((e) => sql`(${e}::text)`), sql`, `)}
    )
    SELECT
      i.email,
      EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.event_id = ${eventId}
          AND public.canonicalize_email(t.email) = i.email
      ) AS has_ticket,
      EXISTS (
        SELECT 1 FROM email_unsubscribes u
        WHERE u.scope = 'event'
          AND u.event_id = ${eventId}
          AND u.email = i.email
      ) AS event_opted,
      EXISTS (
        SELECT 1 FROM email_unsubscribes u
        WHERE u.scope = 'announce'
          AND u.event_id IS NULL
          AND u.email = i.email
      ) AS announce_opted
    FROM input i
  `);

  const kept: string[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    const blocked = row.has_ticket
      ? row.event_opted
      : row.event_opted || row.announce_opted;
    if (blocked) skipped.push(row.email);
    else kept.push(row.email);
  }
  return { kept, skipped };
}

export async function filterUnsubscribed(
  emails: string[],
  scope: UnsubscribeScope,
  eventId?: string | null,
): Promise<FilterResult> {
  const normalized = [
    ...new Set(
      emails
        .map((e) => canonicalizeEmail(e))
        .filter((e) => e.length > 0),
    ),
  ];

  if (normalized.length === 0) return { kept: [], skipped: [] };
  if (scope === "event" && !eventId) return { kept: normalized, skipped: [] };

  const scopeClause = scope === "announce"
    ? sql`${emailUnsubscribes.scope} = 'announce' AND ${emailUnsubscribes.eventId} IS NULL`
    : scope === "newsletter"
      ? sql`${emailUnsubscribes.scope} = 'newsletter' AND ${emailUnsubscribes.eventId} IS NULL`
      : sql`${emailUnsubscribes.scope} = 'event' AND ${emailUnsubscribes.eventId} = ${eventId}`;

  const rows = await db
    .select({ email: emailUnsubscribes.email })
    .from(emailUnsubscribes)
    .where(
      and(
        scopeClause,
        sql`lower(trim(${emailUnsubscribes.email})) in (${sql.join(normalized.map((e) => sql`${e}`), sql`, `)})`,
      ),
    );

  const optedOut = new Set(rows.map((r) => canonicalizeEmail(r.email)));

  const kept: string[] = [];
  const skipped: string[] = [];
  for (const email of normalized) {
    if (optedOut.has(email)) skipped.push(email);
    else kept.push(email);
  }
  return { kept, skipped };
}

/**
 * Newsletter-send filter. Newsletter is a narrower opt-out than announce, so
 * a newsletter send must respect BOTH the newsletter opt-out (specific) and
 * the announce opt-out (broad "stop all promo"). Conversely, announce-scope
 * promo sends do NOT need to check newsletter — a newsletter-only opt-out
 * still wants to hear about new speakers.
 */
export async function filterForNewsletter(
  emails: string[],
): Promise<FilterResult> {
  const normalized = [
    ...new Set(
      emails
        .map((e) => canonicalizeEmail(e))
        .filter((e) => e.length > 0),
    ),
  ];

  if (normalized.length === 0) return { kept: [], skipped: [] };

  const rows = await db
    .select({ email: emailUnsubscribes.email })
    .from(emailUnsubscribes)
    .where(
      and(
        sql`${emailUnsubscribes.scope} IN ('announce', 'newsletter')`,
        sql`${emailUnsubscribes.eventId} IS NULL`,
        sql`lower(trim(${emailUnsubscribes.email})) in (${sql.join(normalized.map((e) => sql`${e}`), sql`, `)})`,
      ),
    );

  const optedOut = new Set(rows.map((r) => canonicalizeEmail(r.email)));

  const kept: string[] = [];
  const skipped: string[] = [];
  for (const email of normalized) {
    if (optedOut.has(email)) skipped.push(email);
    else kept.push(email);
  }
  return { kept, skipped };
}

export async function recordUnsubscribe(opts: {
  email: string;
  scope: UnsubscribeScope;
  eventId?: string | null;
  source: string;
  actor: string;
  reason?: string | null;
  audit?: {
    action: "mailing_list.unsubscribe" | "mailing_list.admin_unsubscribe";
    eventName?: string | null;
  };
}): Promise<{ created: boolean }> {
  const email = canonicalizeEmail(opts.email);
  if (!email) throw new Error("email required");
  if (opts.scope === "event" && !opts.eventId) {
    throw new Error("eventId required for event scope");
  }

  const result = await db
    .insert(emailUnsubscribes)
    .values({
      email,
      scope: opts.scope,
      eventId: opts.scope === "event" ? opts.eventId! : null,
      source: opts.source,
      actor: opts.actor,
      reason: opts.reason ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: emailUnsubscribes.id });

  const created = result.length > 0;

  if (created && opts.audit) {
    await logAuditEvent({
      action: opts.audit.action,
      actor: opts.actor,
      eventId: opts.scope === "event" ? opts.eventId ?? null : null,
      eventName: opts.audit.eventName ?? null,
      targetEmail: email,
      metadata: {
        scope: opts.scope,
        source: opts.source,
        reason: opts.reason ?? undefined,
      },
    });
  }

  return { created };
}

export async function recordResubscribe(opts: {
  email: string;
  scope: UnsubscribeScope;
  eventId?: string | null;
  actor: string;
  audit?: {
    action: "mailing_list.resubscribe" | "mailing_list.admin_resubscribe";
    eventName?: string | null;
  };
}): Promise<{ removed: boolean }> {
  const email = canonicalizeEmail(opts.email);
  if (!email) throw new Error("email required");
  if (opts.scope === "event" && !opts.eventId) {
    throw new Error("eventId required for event scope");
  }

  const where = opts.scope === "event"
    ? and(
      eq(emailUnsubscribes.email, email),
      eq(emailUnsubscribes.scope, "event"),
      eq(emailUnsubscribes.eventId, opts.eventId!),
    )
    : and(
      eq(emailUnsubscribes.email, email),
      eq(emailUnsubscribes.scope, opts.scope),
      isNull(emailUnsubscribes.eventId),
    );

  const result = await db
    .delete(emailUnsubscribes)
    .where(where)
    .returning({ id: emailUnsubscribes.id });

  const removed = result.length > 0;

  if (removed && opts.audit) {
    await logAuditEvent({
      action: opts.audit.action,
      actor: opts.actor,
      eventId: opts.scope === "event" ? opts.eventId ?? null : null,
      eventName: opts.audit.eventName ?? null,
      targetEmail: email,
      metadata: { scope: opts.scope },
    });
  }

  return { removed };
}

export async function listAnnounceMembers(opts: {
  search?: string | null;
  limit: number;
  offset: number;
}): Promise<
  { rows: { email: string; displayEmail: string; source: string }[]; total: number }
> {
  const search = (opts.search ?? "").trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(200, opts.limit));
  const safeOffset = Math.max(0, opts.offset);

  const searchClause = search
    ? sql`AND (m.email LIKE ${"%" + search + "%"} OR lower(m.display_email) LIKE ${"%" + search + "%"})`
    : sql``;

  const totalRows = await db.execute<{ total: string }>(sql`
    SELECT count(*)::text AS total
    FROM mailing_list m
    WHERE NOT EXISTS (
        SELECT 1 FROM email_unsubscribes u
        WHERE u.scope = 'announce'
          AND u.event_id IS NULL
          AND u.email = m.email
      )
      ${searchClause}
  `);

  const dataRows = await db.execute<{
    email: string;
    display_email: string;
    source: string;
  }>(sql`
    SELECT m.email, m.display_email, m.source
    FROM mailing_list m
    WHERE NOT EXISTS (
        SELECT 1 FROM email_unsubscribes u
        WHERE u.scope = 'announce'
          AND u.event_id IS NULL
          AND u.email = m.email
      )
      ${searchClause}
    ORDER BY m.email
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `);

  const total = Number.parseInt(totalRows[0]?.total ?? "0", 10) || 0;

  return {
    rows: dataRows.map((r) => ({
      email: r.email,
      displayEmail: r.display_email,
      source: r.source,
    })),
    total,
  };
}

export async function announceStats(): Promise<{
  total: number;
  optedOut: number;
}> {
  const totalRows = await db.execute<{ total: string }>(sql`
    SELECT count(*)::text AS total
    FROM mailing_list m
    WHERE NOT EXISTS (
      SELECT 1 FROM email_unsubscribes u
      WHERE u.scope = 'announce'
        AND u.event_id IS NULL
        AND u.email = m.email
    )
  `);

  const optOutRows = await db.execute<{ total: string }>(sql`
    SELECT count(*)::text AS total
    FROM email_unsubscribes
    WHERE scope = 'announce' AND event_id IS NULL
  `);

  return {
    total: Number.parseInt(totalRows[0]?.total ?? "0", 10) || 0,
    optedOut: Number.parseInt(optOutRows[0]?.total ?? "0", 10) || 0,
  };
}

export async function listAnnounceOptOuts(): Promise<UnsubscribeRecord[]> {
  const rows = await db.query.emailUnsubscribes.findMany({
    where: and(
      eq(emailUnsubscribes.scope, "announce"),
      isNull(emailUnsubscribes.eventId),
    ),
    orderBy: (t, { desc }) => desc(t.createdAt),
  });

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    scope: "announce" as const,
    eventId: null,
    source: r.source,
    reason: r.reason,
    actor: r.actor,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listNewsletterMembers(opts: {
  search?: string | null;
  limit: number;
  offset: number;
}): Promise<
  { rows: { email: string; displayEmail: string; source: string }[]; total: number }
> {
  const search = (opts.search ?? "").trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(200, opts.limit));
  const safeOffset = Math.max(0, opts.offset);

  // Newsletter receivers = mailing_list MINUS announce opt-outs MINUS
  // newsletter opt-outs. (Announce opt-outs block all promo, so they
  // shouldn't see the newsletter either.)
  const searchClause = search
    ? sql`AND (m.email LIKE ${"%" + search + "%"} OR lower(m.display_email) LIKE ${"%" + search + "%"})`
    : sql``;

  const totalRows = await db.execute<{ total: string }>(sql`
    SELECT count(*)::text AS total
    FROM mailing_list m
    WHERE NOT EXISTS (
        SELECT 1 FROM email_unsubscribes u
        WHERE u.scope IN ('announce', 'newsletter')
          AND u.event_id IS NULL
          AND u.email = m.email
      )
      ${searchClause}
  `);

  const dataRows = await db.execute<{
    email: string;
    display_email: string;
    source: string;
  }>(sql`
    SELECT m.email, m.display_email, m.source
    FROM mailing_list m
    WHERE NOT EXISTS (
        SELECT 1 FROM email_unsubscribes u
        WHERE u.scope IN ('announce', 'newsletter')
          AND u.event_id IS NULL
          AND u.email = m.email
      )
      ${searchClause}
    ORDER BY m.email
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `);

  const total = Number.parseInt(totalRows[0]?.total ?? "0", 10) || 0;

  return {
    rows: dataRows.map((r) => ({
      email: r.email,
      displayEmail: r.display_email,
      source: r.source,
    })),
    total,
  };
}

export async function newsletterStats(): Promise<{
  total: number;
  optedOut: number;
}> {
  const totalRows = await db.execute<{ total: string }>(sql`
    SELECT count(*)::text AS total
    FROM mailing_list m
    WHERE NOT EXISTS (
      SELECT 1 FROM email_unsubscribes u
      WHERE u.scope IN ('announce', 'newsletter')
        AND u.event_id IS NULL
        AND u.email = m.email
    )
  `);

  const optOutRows = await db.execute<{ total: string }>(sql`
    SELECT count(*)::text AS total
    FROM email_unsubscribes
    WHERE scope = 'newsletter' AND event_id IS NULL
  `);

  return {
    total: Number.parseInt(totalRows[0]?.total ?? "0", 10) || 0,
    optedOut: Number.parseInt(optOutRows[0]?.total ?? "0", 10) || 0,
  };
}

export async function listNewsletterOptOuts(): Promise<UnsubscribeRecord[]> {
  const rows = await db.query.emailUnsubscribes.findMany({
    where: and(
      eq(emailUnsubscribes.scope, "newsletter"),
      isNull(emailUnsubscribes.eventId),
    ),
    orderBy: (t, { desc }) => desc(t.createdAt),
  });

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    scope: "newsletter" as const,
    eventId: null,
    source: r.source,
    reason: r.reason,
    actor: r.actor,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listEventOptOuts(eventId: string): Promise<UnsubscribeRecord[]> {
  const rows = await db.query.emailUnsubscribes.findMany({
    where: and(
      eq(emailUnsubscribes.scope, "event"),
      eq(emailUnsubscribes.eventId, eventId),
    ),
    orderBy: (t, { desc }) => desc(t.createdAt),
  });

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    scope: "event" as const,
    eventId: r.eventId,
    source: r.source,
    reason: r.reason,
    actor: r.actor,
    createdAt: r.createdAt.toISOString(),
  }));
}
