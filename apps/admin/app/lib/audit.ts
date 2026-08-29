import { db, auditLogs } from "@ssb/db";

type AuditAction =
  | "ticket.create"
  | "ticket.delete"
  | "ticket.update_name"
  | "ticket.update_title"
  | "ticket.update_type"
  | "ticket.cancel"
  | "ticket.uncancel"
  | "ticket.unscan"
  | "email.send"
  | "email.send_mass"
  | "event.create"
  | "event.edit"
  | "event.toggle_live"
  | "event.toggle_standby"
  | "event.toggle_identity_verification"
  | "event.toggle_allow_admitting_standby"
  | "event.delete"
  | "user.add_role"
  | "user.remove_role"
  | "permission.grant"
  | "permission.revoke"
  | "suggestion.approve"
  | "suggestion.reject"
  | "suggestion.unapprove"
  | "suggestion.edit"
  | "suggestion.mark_duplicate"
  | "suggestion.mark_spoke"
  | "suggestion.merge"
  | "suggestion.sync_votes"
  | "suggestion.edit_votes"
  | "event_question.approve"
  | "event_question.reject"
  | "event_question.edit"
  | "event_question.hide"
  | "event_question.unhide"
  | "event_question.mark_duplicate"
  | "event_question.merge"
  | "event_question.sync_votes"
  | "event_question.edit_votes"
  | "event_question.event_enabled"
  | "event_question.event_disabled"
  | "event_question.rankings_shown"
  | "event_question.rankings_hidden"
  | "waitlist.pull"
  | "waitlist.issue_standby"
  | "waitlist.convert_standby"
  | "referral.toggle"
  | "campaign.create"
  | "campaign.send"
  | "email.send_failed"
  | "mailing_list.subscribe"
  | "mailing_list.unsubscribe"
  | "mailing_list.resubscribe"
  | "mailing_list.admin_unsubscribe"
  | "mailing_list.admin_resubscribe"
  | "wallet.push";

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
        source: "admin",
        eventId: params.eventId ?? null,
        eventName: params.eventName ?? null,
        targetEmail: params.targetEmail ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      });
  } catch (err) {
    console.error("[audit] Failed to log event:", err);
  }
}
