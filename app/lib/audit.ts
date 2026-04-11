import { db, auditLogs } from "@ssb/db";

type AuditAction =
  | "notify.signup"
  | "ticket.get"
  | "ticket.ineligible"
  | "ticket.cancel"
  | "waitlist.join"
  | "waitlist.leave"
  | "waitlist.pull"
  | "scan.fail";

type AuditLogParams = {
  action: AuditAction;
  actor: string;
  eventId?: string | null;
  eventName?: string | null;
  targetEmail?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogs)
      .values({
        action: params.action,
        actor: params.actor,
        source: "web",
        eventId: params.eventId ?? null,
        eventName: params.eventName ?? null,
        targetEmail: params.targetEmail ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      });
  } catch (err) {
    console.error("[audit] Failed to log event:", err);
  }
}
