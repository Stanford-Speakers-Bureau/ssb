import {
  and,
  db,
  emailUnsubscribes,
  eq,
  isNull,
  mailingList,
} from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";
import { canonicalizeEmail } from "@/app/lib/validation";

export type UnsubscribeScope = "announce" | "event" | "newsletter";

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
 *   itself (self-action).
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

export async function recordSelfUnsubscribe(opts: {
  email: string;
  scope: UnsubscribeScope;
  eventId?: string | null;
  source: string;
  reason?: string | null;
  eventName?: string | null;
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
      actor: email,
      reason: opts.reason ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: emailUnsubscribes.id });

  const created = result.length > 0;

  if (created) {
    await logAuditEvent({
      action: "mailing_list.unsubscribe",
      actor: email,
      eventId: opts.scope === "event" ? opts.eventId ?? null : null,
      eventName: opts.eventName ?? null,
      targetEmail: email,
      metadata: {
        scope: opts.scope,
        source: opts.source,
        confirmed: true,
      },
    });
  }

  return { created };
}

export async function recordSelfResubscribe(opts: {
  email: string;
  scope: UnsubscribeScope;
  eventId?: string | null;
  eventName?: string | null;
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

  if (removed) {
    await logAuditEvent({
      action: "mailing_list.resubscribe",
      actor: email,
      eventId: opts.scope === "event" ? opts.eventId ?? null : null,
      eventName: opts.eventName ?? null,
      targetEmail: email,
      metadata: { scope: opts.scope },
    });
  }

  return { removed };
}
