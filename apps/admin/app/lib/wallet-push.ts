import { db, inArray, tickets } from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";

const FUNCTION_NAME = "apns-push";

type WalletPushContext = {
  actor?: string;
  reason?: string;
  eventId?: string | null;
  eventName?: string | null;
};

/**
 * Marks the given tickets as wallet-changed (bumps wallet_updated_at) and asks
 * the APNs edge function to push a refresh to every device registered for them.
 * Records the outcome (devices reached / pruned) in the audit log.
 *
 * Best-effort: this never throws into the calling mutation. A failed or
 * unconfigured push must not fail the underlying admin action — the pass will
 * still pick up the change the next time the device polls the web service.
 */
export async function pushWalletUpdate(
  ticketIds: string[],
  context: WalletPushContext = {},
): Promise<void> {
  const ids = ticketIds.filter(Boolean);
  if (ids.length === 0) return;

  try {
    await db
      .update(tickets)
      .set({ walletUpdatedAt: new Date() })
      .where(inArray(tickets.id, ids));
  } catch (e) {
    // If we can't even record the change, there's nothing to push.
    console.error("[wallet-push] failed to bump wallet_updated_at:", e);
    return;
  }

  const base = process.env.SUPABASE_URL;
  const secret = process.env.WALLET_PUSH_SECRET;
  const apiKey = process.env.SUPABASE_KEY;
  if (!base || !secret) {
    console.warn(
      "[wallet-push] SUPABASE_URL or WALLET_PUSH_SECRET unset; skipping push",
    );
    return;
  }

  let ok = false;
  let sent: number | null = null;
  let pruned: number | null = null;
  try {
    const res = await fetch(`${base}/functions/v1/${FUNCTION_NAME}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-wallet-push-secret": secret,
        ...(apiKey ? { authorization: `Bearer ${apiKey}`, apikey: apiKey } : {}),
      },
      body: JSON.stringify({ serialNumbers: ids }),
    });
    if (!res.ok) {
      console.error(
        `[wallet-push] edge function ${res.status}: ${await res.text()}`,
      );
    } else {
      ok = true;
      try {
        const body = (await res.json()) as { sent?: number; pruned?: number };
        sent = body.sent ?? null;
        pruned = body.pruned ?? null;
      } catch {
        // edge function returned a non-JSON 2xx — leave counts null
      }
    }
  } catch (e) {
    console.error("[wallet-push] edge function invocation failed:", e);
  }

  // logAuditEvent swallows its own errors, so this stays best-effort.
  await logAuditEvent({
    action: "wallet.push",
    actor: context.actor ?? "system",
    eventId: context.eventId ?? null,
    eventName: context.eventName ?? null,
    metadata: {
      reason: context.reason ?? null,
      ticketCount: ids.length,
      devicesPushed: sent,
      registrationsPruned: pruned,
      ok,
    },
  });
}
