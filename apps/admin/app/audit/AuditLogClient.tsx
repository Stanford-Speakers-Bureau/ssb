"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronDownIcon,
  FunnelIcon,
} from "@heroicons/react/16/solid";
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  StatusPill,
  Table,
  TableScroll,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/app/components/ui";

type AuditLogEntry = {
  kind: "log";
  id: string;
  created_at: string;
  action: string;
  actor: string;
  source: string;
  event_id: string | null;
  event_name: string | null;
  target_email: string | null;
  metadata: Record<string, unknown> | null;
};

type AuditLogGroup = {
  kind: "group";
  id: string;
  created_at: string;
  action: string;
  actor: string;
  source: string;
  event_id: string | null;
  event_name: string | null;
  target_email: null;
  metadata: Record<string, unknown> | null;
  entries: AuditLogEntry[];
  group_count: number;
  failures?: AuditLogEntry[];
};

type AuditLogItem = AuditLogEntry | AuditLogGroup;

const ACTION_LABELS: Record<string, string> = {
  "notify.signup": "Signed up for Notify",
  "ticket.get": "Got Ticket",
  "ticket.ineligible": "Blocked Ineligible Claim",
  "ticket.cancel": "Canceled Ticket",
  "ticket.create": "Created Ticket",
  "ticket.delete": "Deleted Ticket",
  "ticket.update_name": "Updated Name",
  "ticket.update_type": "Updated Type",
  "ticket.unscan": "Unscanned Ticket",
  "email.send": "Sent Email",
  "email.send_mass": "Sent Mass Email",
  "event.create": "Created Event",
  "event.edit": "Edited Event",
  "event.toggle_live": "Toggled Live",
  "event.toggle_standby": "Toggled Standby",
  "event.delete": "Deleted Event",
  "user.add_role": "Added Role",
  "user.remove_role": "Removed Role",
  "suggestion.submit": "Submitted Suggestion",
  "suggestion.approve": "Approved Suggestion",
  "suggestion.reject": "Rejected Suggestion",
  "suggestion.edit": "Edited Suggestion",
  "suggestion.mark_duplicate": "Marked Duplicate",
  "suggestion.mark_spoke": "Marked Spoke",
  "suggestion.merge": "Merged Suggestions",
  "suggestion.sync_votes": "Synced Suggestion Votes",
  "suggestion.edit_votes": "Edited Suggestion Votes",
  "event_question.submit": "Submitted Question",
  "event_question.approve": "Approved Question",
  "event_question.reject": "Rejected Question",
  "event_question.edit": "Edited Question",
  "event_question.hide": "Hid Question",
  "event_question.unhide": "Unhid Question",
  "event_question.mark_duplicate": "Marked Question Duplicate",
  "event_question.merge": "Merged Questions",
  "event_question.sync_votes": "Synced Q&A Votes",
  "event_question.edit_votes": "Edited Q&A Votes",
  "event_question.event_enabled": "Enabled Q&A",
  "event_question.event_disabled": "Disabled Q&A",
  "event_question.rankings_shown": "Showed Q&A Rankings",
  "event_question.rankings_hidden": "Hid Q&A Rankings",
  "campaign.create": "Created Campaign",
  "campaign.send": "Sent Campaign",
  "email.send_failed": "Email Send Failed",
  "mailing_list.subscribe": "Subscribed to Mailing List",
  "mailing_list.unsubscribe": "Unsubscribed from Mailing List",
  "mailing_list.resubscribe": "Resubscribed to Mailing List",
  "mailing_list.admin_unsubscribe": "Admin Unsubscribed (Mailing List)",
  "mailing_list.admin_resubscribe": "Admin Resubscribed (Mailing List)",
  "waitlist.join": "Joined Waitlist",
  "waitlist.leave": "Left Waitlist",
  "waitlist.pull": "Pulled From Waitlist",
  "waitlist.issue_standby": "Issued Standby Tickets",
  "waitlist.convert_standby": "Converted Standby Tickets",
  "referral.toggle": "Toggled Referrals",
  "wallet.install": "Installed Wallet Pass",
  "wallet.uninstall": "Removed Wallet Pass",
  "wallet.push": "Pushed Wallet Update",
};

const ACTION_OPTIONS = [
  {
    group: "Tickets",
    actions: [
      "ticket.get",
      "ticket.ineligible",
      "ticket.cancel",
      "ticket.create",
      "ticket.delete",
      "ticket.update_name",
      "ticket.update_type",
      "ticket.unscan",
    ],
  },
  { group: "Email", actions: ["email.send", "email.send_mass"] },
  {
    group: "Events",
    actions: [
      "event.create",
      "event.edit",
      "event.toggle_live",
      "event.toggle_standby",
      "event.delete",
    ],
  },
  { group: "Users", actions: ["user.add_role", "user.remove_role"] },
  {
    group: "Suggestions",
    actions: [
      "suggestion.submit",
      "suggestion.approve",
      "suggestion.reject",
      "suggestion.edit",
      "suggestion.mark_duplicate",
      "suggestion.mark_spoke",
      "suggestion.merge",
      "suggestion.sync_votes",
      "suggestion.edit_votes",
    ],
  },
  {
    group: "Moderator Q&A",
    actions: [
      "event_question.submit",
      "event_question.approve",
      "event_question.reject",
      "event_question.edit",
      "event_question.hide",
      "event_question.unhide",
      "event_question.mark_duplicate",
      "event_question.merge",
      "event_question.sync_votes",
      "event_question.edit_votes",
      "event_question.event_enabled",
      "event_question.event_disabled",
      "event_question.rankings_shown",
      "event_question.rankings_hidden",
    ],
  },
  { group: "Campaigns", actions: ["campaign.create", "campaign.send"] },
  {
    group: "Mailing List",
    actions: [
      "mailing_list.subscribe",
      "mailing_list.unsubscribe",
      "mailing_list.resubscribe",
      "mailing_list.admin_unsubscribe",
      "mailing_list.admin_resubscribe",
    ],
  },
  {
    group: "Waitlist",
    actions: [
      "waitlist.join",
      "waitlist.leave",
      "waitlist.pull",
      "waitlist.issue_standby",
      "waitlist.convert_standby",
    ],
  },
  { group: "Referrals", actions: ["referral.toggle"] },
  { group: "Notify", actions: ["notify.signup"] },
  {
    group: "Wallet",
    actions: ["wallet.install", "wallet.uninstall", "wallet.push"],
  },
];

const ACTION_FILTER_OPTIONS = ACTION_OPTIONS.flatMap((group) =>
  group.actions.map((action) => ({
    value: action,
    label: ACTION_LABELS[action] || action,
    group: group.group,
  })),
);
const ACTION_VALUES = ACTION_FILTER_OPTIONS.map((option) => option.value);
const DEFAULT_EXCLUDED_ACTIONS = new Set([
  "notify.signup",
  "ticket.get",
  "waitlist.join",
  "mailing_list.subscribe",
  "mailing_list.unsubscribe",
  "mailing_list.resubscribe",
  "suggestion.submit",
  "event_question.submit",
  "wallet.install",
  "wallet.push",
]);
const DEFAULT_ACTION_VALUES = ACTION_VALUES.filter(
  (action) => !DEFAULT_EXCLUDED_ACTIONS.has(action),
);

const SOURCE_FILTER_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "web", label: "Web" },
  { value: "wallet", label: "Wallet" },
] as const;
const SOURCE_VALUES = SOURCE_FILTER_OPTIONS.map((option) => option.value);

type FilterDropdownKey = "action" | "source";
type FilterOption = {
  value: string;
  label: string;
  group?: string;
};

function getActionColor(action: string) {
  if (action.startsWith("ticket."))
    return "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30";
  if (action.startsWith("email."))
    return "bg-blue-500/15 text-blue-400 ring-1 ring-inset ring-blue-500/30";
  if (action.startsWith("event_question."))
    return "bg-violet-500/15 text-violet-400 ring-1 ring-inset ring-violet-500/30";
  if (action.startsWith("event."))
    return "bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30";
  if (action.startsWith("user."))
    return "bg-pink-500/15 text-pink-400 ring-1 ring-inset ring-pink-500/30";
  if (action.startsWith("suggestion."))
    return "bg-orange-500/15 text-orange-400 ring-1 ring-inset ring-orange-500/30";
  if (action.startsWith("campaign."))
    return "bg-teal-500/15 text-teal-400 ring-1 ring-inset ring-teal-500/30";
  if (action.startsWith("mailing_list."))
    return "bg-lime-500/15 text-lime-400 ring-1 ring-inset ring-lime-500/30";
  if (action.startsWith("waitlist."))
    return "bg-cyan-500/15 text-cyan-400 ring-1 ring-inset ring-cyan-500/30";
  if (action.startsWith("referral."))
    return "bg-indigo-500/15 text-indigo-400 ring-1 ring-inset ring-indigo-500/30";
  if (action.startsWith("notify."))
    return "bg-purple-500/15 text-purple-400 ring-1 ring-inset ring-purple-500/30";
  if (action.startsWith("wallet."))
    return "bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30";
  return "bg-zinc-500/15 text-zinc-400 ring-1 ring-inset ring-zinc-500/30";
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isAuditLogGroup(log: AuditLogItem): log is AuditLogGroup {
  return log.kind === "group";
}

function getMetadataNumber(
  metadata: Record<string, unknown> | null,
  key: string,
): number {
  const value = metadata?.[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatMetadataKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatMetadataValue(item)).join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

const METADATA_RENDERED_SEPARATELY = new Set([
  "batchId",
  "initial",
  "changes",
  "changedFields",
  // Recipient roster is rendered as its own list; chunk counters are internal
  // plumbing we no longer surface.
  "recipients",
  "recipientCount",
  "chunkIndex",
  "chunkCount",
]);

function getMetadataEntries(
  metadata: Record<string, unknown> | null,
): Array<[string, unknown]> {
  if (!metadata) {
    return [];
  }

  return Object.entries(metadata).filter(([key, value]) => {
    if (METADATA_RENDERED_SEPARATELY.has(key)) return false;
    return value !== null && value !== undefined && value !== "";
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFromToChange(
  value: unknown,
): value is { from: unknown; to: unknown } {
  return isPlainObject(value) && "from" in value && "to" in value;
}

const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "string" && ISO_DATE_REGEX.test(value)) {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  return formatMetadataValue(value);
}

function getMassEmailLabel(metadata: Record<string, unknown> | null): string {
  const type = metadata?.type;
  const kind = metadata?.kind;
  const variant = metadata?.variant;

  if (typeof metadata?.campaignId === "string") {
    const subject =
      typeof metadata?.subject === "string" ? metadata.subject.trim() : "";
    return subject.length > 0 ? subject : "Campaign";
  }

  if (type === "bulkSend") {
    if (kind === "announcement") return "Announcements";
    if (kind === "ticketsAvailableNow") return "Tickets available now";
    if (kind === "ticketsAvailableIn") return "Tickets available in";
    if (kind === "claimTicket") return "Claim ticket";
    return "Bulk send";
  }

  if (type === "notifySend") {
    if (variant === "claim") return "Claim ticket notify";
    if (variant === "in") return "Tickets available in notify";
    if (variant === "now") return "Tickets available now notify";
    return "Notify send";
  }

  if (type === "dayOfReminders") return "Day-of reminders";
  if (type === "earlyReminders") return "Early reminders";

  return "Mass email";
}

function getDetailsSummary(log: AuditLogItem): string {
  if (log.action === "event.edit") {
    const changed = log.metadata?.changedFields;
    if (Array.isArray(changed) && changed.length > 0) {
      const fields = changed
        .map((field) => formatMetadataKey(String(field)))
        .slice(0, 3)
        .join(", ");
      const suffix = changed.length > 3 ? ` +${changed.length - 3} more` : "";
      const label = changed.length === 1 ? "field" : "fields";
      return `${changed.length} ${label} updated: ${fields}${suffix}`;
    }
    if (Array.isArray(changed) && changed.length === 0) {
      return "No changes";
    }
  }

  if (log.action === "event.create" && isPlainObject(log.metadata?.initial)) {
    const initial = log.metadata!.initial as Record<string, unknown>;
    const parts: string[] = [];
    if (initial.venue)
      parts.push(`Venue: ${formatMetadataValue(initial.venue)}`);
    if (typeof initial.capacity === "number")
      parts.push(`Capacity: ${initial.capacity.toLocaleString()}`);
    if (initial.startTime)
      parts.push(`Start: ${formatChangeValue(initial.startTime)}`);
    if (parts.length > 0) return parts.slice(0, 3).join(" • ");
    return "Initial details captured";
  }

  if (log.action === "email.send_mass" || log.action === "campaign.send") {
    const label = getMassEmailLabel(log.metadata);
    const sent = getMetadataNumber(log.metadata, "sent");
    const failed = getMetadataNumber(log.metadata, "failed");
    const skipped = getMetadataNumber(log.metadata, "skipped");
    const skippedHasTicket = getMetadataNumber(
      log.metadata,
      "skippedHasTicket",
    );
    const skippedOptedOut = getMetadataNumber(log.metadata, "skippedOptedOut");
    const suppressed = getMetadataNumber(log.metadata, "suppressed");
    const segments = [`${label}`, `${sent.toLocaleString()} sent`];

    if (failed > 0) {
      segments.push(`${failed.toLocaleString()} failed`);
    }
    if (skippedHasTicket > 0) {
      segments.push(
        `${skippedHasTicket.toLocaleString()} already had a ticket`,
      );
    }
    if (skippedOptedOut > 0) {
      segments.push(`${skippedOptedOut.toLocaleString()} opted out`);
    }
    if (suppressed > 0) {
      segments.push(`${suppressed.toLocaleString()} suppressed`);
    }
    // Fall back to the summed skip count for older rows that predate the
    // broken-out categories.
    if (skippedHasTicket === 0 && skippedOptedOut === 0 && skipped > 0) {
      segments.push(`${skipped.toLocaleString()} skipped`);
    }

    return segments.join(" • ");
  }

  const metadataEntries = getMetadataEntries(log.metadata);
  if (metadataEntries.length === 0) {
    return "No additional details";
  }

  return metadataEntries
    .slice(0, 2)
    .map(
      ([key, value]) =>
        `${formatMetadataKey(key)}: ${formatMetadataValue(value)}`,
    )
    .join(" • ");
}

const PAGE_SIZE = 50;

function ChangesGrid({ changes }: { changes: Record<string, unknown> }) {
  const entries = Object.entries(changes).filter(([, value]) =>
    isFromToChange(value),
  ) as Array<[string, { from: unknown; to: unknown }]>;

  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No field-level changes recorded.</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([field, change]) => (
        <div
          key={field}
          className="rounded-lg border border-white/10 bg-zinc-900/60 p-3"
        >
          <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
            {formatMetadataKey(field)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-rose-200 ring-1 ring-inset ring-rose-500/30 break-words">
              {formatChangeValue(change.from)}
            </span>
            <span className="text-zinc-500">→</span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-200 ring-1 ring-inset ring-emerald-500/30 break-words">
              {formatChangeValue(change.to)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SnapshotGrid({ snapshot }: { snapshot: Record<string, unknown> }) {
  const entries = Object.entries(snapshot).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No starting values captured.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-lg border border-white/10 bg-zinc-900/60 p-3"
        >
          <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
            {formatMetadataKey(key)}
          </p>
          <p className="mt-1 text-sm text-zinc-200 break-words">
            {formatChangeValue(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function FailedRecipients({ failures }: { failures: AuditLogEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? failures : failures.slice(0, 25);

  const errorOf = (entry: AuditLogEntry): string => {
    const err = entry.metadata?.error;
    if (typeof err === "string" && err.trim().length > 0) return err;
    if (isPlainObject(err)) {
      const message = (err as Record<string, unknown>).message;
      if (typeof message === "string" && message.trim().length > 0)
        return message;
      try {
        return JSON.stringify(err);
      } catch {
        return "Unknown error";
      }
    }
    return "Unknown error";
  };

  const csv = () => {
    const header = "email,error\n";
    const body = failures
      .map((f) => {
        const email = f.target_email ?? "";
        const error = errorOf(f).replace(/"/g, '""');
        return `"${email}","${error}"`;
      })
      .join("\n");
    return header + body;
  };

  const downloadCsv = () => {
    const blob = new Blob([csv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `failed-recipients-${failures.length}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl bg-rose-950/20 p-4 ring-1 ring-inset ring-rose-500/30">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-rose-200">
            Failed recipients ({failures.length.toLocaleString()})
          </p>
          <p className="text-xs text-rose-300/70">
            Per-recipient send errors recorded during this run.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={downloadCsv}
          className="px-3 py-1.5 text-xs"
        >
          Download CSV
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg ring-1 ring-inset ring-rose-500/20">
        <table className="w-full text-sm">
          <thead className="bg-rose-500/10">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-rose-200/80">
                Email
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-rose-200/80">
                Error
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((f) => (
              <tr key={f.id} className="border-t border-rose-500/10">
                <td className="px-3 py-2 align-top text-zinc-200 break-all">
                  {f.target_email ?? "(unknown)"}
                </td>
                <td className="px-3 py-2 align-top text-zinc-400 break-words">
                  {errorOf(f)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {failures.length > visible.length ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs font-medium text-rose-300 underline-offset-2 hover:underline"
        >
          Show all {failures.length.toLocaleString()} failures
        </button>
      ) : showAll && failures.length > 25 ? (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-3 text-xs font-medium text-rose-300 underline-offset-2 hover:underline"
        >
          Show fewer
        </button>
      ) : null}
    </div>
  );
}

function getMetadataRecipients(
  metadata: Record<string, unknown> | null,
): string[] {
  const value = metadata?.recipients;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (email): email is string => typeof email === "string" && email.length > 0,
  );
}

function SentRecipients({ recipients }: { recipients: string[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? recipients : recipients.slice(0, 25);

  const downloadCsv = () => {
    const csv = "email\n" + recipients.map((email) => `"${email}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recipients-${recipients.length}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl bg-emerald-950/20 p-4 ring-1 ring-inset ring-emerald-500/30">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-200">
            Recipients ({recipients.length.toLocaleString()})
          </p>
          <p className="text-xs text-emerald-300/70">
            Everyone this email was successfully delivered to.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={downloadCsv}
          className="px-3 py-1.5 text-xs"
        >
          Download CSV
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((email) => (
          <span
            key={email}
            className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-100 ring-1 ring-inset ring-emerald-500/20 break-all"
          >
            {email}
          </span>
        ))}
      </div>
      {recipients.length > visible.length ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs font-medium text-emerald-300 underline-offset-2 hover:underline"
        >
          Show all {recipients.length.toLocaleString()} recipients
        </button>
      ) : showAll && recipients.length > 25 ? (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-3 text-xs font-medium text-emerald-300 underline-offset-2 hover:underline"
        >
          Show fewer
        </button>
      ) : null}
    </div>
  );
}

function MetadataDetails({
  metadata,
}: {
  metadata: Record<string, unknown> | null;
}) {
  const metadataEntries = getMetadataEntries(metadata);
  const initial = metadata?.initial;
  const changes = metadata?.changes;
  const hasInitial = isPlainObject(initial);
  const hasChanges = isPlainObject(changes) && Object.keys(changes).length > 0;

  if (metadataEntries.length === 0 && !hasInitial && !hasChanges) {
    return <p className="text-sm text-zinc-500">No additional details.</p>;
  }

  return (
    <div className="space-y-4">
      {hasChanges ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-500">
            Changes
          </p>
          <ChangesGrid changes={changes as Record<string, unknown>} />
        </div>
      ) : null}

      {hasInitial ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-500">
            Starting values
          </p>
          <SnapshotGrid snapshot={initial as Record<string, unknown>} />
        </div>
      ) : null}

      {metadataEntries.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metadataEntries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-white/10 bg-zinc-900/60 p-3"
            >
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
                {formatMetadataKey(key)}
              </p>
              <p className="mt-1 text-sm text-zinc-200 break-words">
                {formatMetadataValue(value)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toggleSelection<T extends string>(
  selected: readonly T[],
  value: T,
  orderedOptions: readonly T[],
): T[] {
  const next = new Set(selected);

  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }

  return orderedOptions.filter((option) => next.has(option));
}

function selectionsMatch<T extends string>(
  selected: readonly T[],
  expected: readonly T[],
): boolean {
  return (
    selected.length === expected.length &&
    selected.every((value, index) => value === expected[index])
  );
}

function summarizeSelection(
  options: readonly FilterOption[],
  selectedValues: readonly string[],
  allLabel: string,
  noneLabel: string,
): string {
  if (selectedValues.length === options.length) return allLabel;
  if (selectedValues.length === 0) return noneLabel;

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  if (selectedLabels.length <= 2) {
    return selectedLabels.join(", ");
  }

  return `${selectedLabels.length} selected`;
}

function FilterDropdown({
  title,
  summary,
  isOpen,
  options,
  selectedValues,
  onToggle,
  onToggleValue,
  onSelectAll,
  onClear,
}: {
  title: string;
  summary: string;
  isOpen: boolean;
  options: readonly FilterOption[];
  selectedValues: readonly string[];
  onToggle: () => void;
  onToggleValue: (value: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex w-full items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <FunnelIcon className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
        <span>{title}</span>
        <span className="max-w-48 truncate text-zinc-400">{summary}</span>
        <ChevronDownIcon
          className={`ml-auto size-4 shrink-0 text-zinc-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-2 w-full min-w-[20rem] rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur">
          <div className="mb-3 px-1">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-zinc-500">
              Choose one or more options to include
            </p>
          </div>
          <div className="mb-3 flex items-center gap-2 px-1">
            <Button
              variant="secondary"
              onClick={onSelectAll}
              className="px-2.5 py-1.5 text-xs"
            >
              Select all
            </Button>
            <Button
              variant="secondary"
              onClick={onClear}
              className="px-2.5 py-1.5 text-xs"
            >
              Clear
            </Button>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {options.map((option, index) => {
              const checked = selectedValues.includes(option.value);
              const previousGroup =
                index > 0 ? options[index - 1]?.group : undefined;
              const showGroupLabel =
                option.group && option.group !== previousGroup;

              return (
                <div key={option.value}>
                  {showGroupLabel ? (
                    <p className="px-2 pb-1 pt-2 text-[11px] font-semibold tracking-wide text-zinc-500">
                      {option.group}
                    </p>
                  ) : null}
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ring-1 ring-inset transition-colors ${
                      checked
                        ? "bg-rose-500/10 text-rose-100 ring-rose-500/30"
                        : "bg-zinc-900/60 text-zinc-300 ring-white/10 hover:bg-white/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleValue(option.value)}
                      className="size-5 rounded accent-rose-500 sm:size-4"
                    />
                    <span>{option.label}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Expanded details for a single log entry / group. Shared by every list
// layout variant (table row, feed, cards, console lines).
function ExpandedDetails({ log }: { log: AuditLogItem }) {
  const sent = getMetadataNumber(log.metadata, "sent");
  const failed = getMetadataNumber(log.metadata, "failed");
  const skipped = getMetadataNumber(log.metadata, "skipped");
  const skippedHasTicket = getMetadataNumber(log.metadata, "skippedHasTicket");
  const skippedOptedOut = getMetadataNumber(log.metadata, "skippedOptedOut");
  const suppressed = getMetadataNumber(log.metadata, "suppressed");
  const hasBrokenOutSkips = skippedHasTicket > 0 || skippedOptedOut > 0;
  const totalRecipients = getMetadataNumber(log.metadata, "total");
  const recipients = getMetadataRecipients(log.metadata);

  return isAuditLogGroup(log) ? (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
          <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
            Sent
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">
            {sent.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
          <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
            Failed
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">
            {failed.toLocaleString()}
          </p>
        </div>
        {hasBrokenOutSkips ? (
          <>
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
                Had ticket
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                {skippedHasTicket.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
                Opted out
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                {skippedOptedOut.toLocaleString()}
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
              Skipped
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
              {skipped.toLocaleString()}
            </p>
          </div>
        )}
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
          <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
            Suppressed
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">
            {suppressed.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3">
          <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
            Recipients
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">
            {totalRecipients.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold text-white">
            {getMassEmailLabel(log.metadata)}
          </p>
          <p className="text-xs text-zinc-500">Grouped mass-email run</p>
        </div>
        <MetadataDetails metadata={log.metadata} />
      </div>

      {recipients.length > 0 ? (
        <SentRecipients recipients={recipients} />
      ) : null}

      {log.failures && log.failures.length > 0 ? (
        <FailedRecipients failures={log.failures} />
      ) : null}
    </div>
  ) : (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {ACTION_LABELS[log.action] || log.action}
          </p>
          <p className="text-xs text-zinc-500">
            {formatTimestamp(log.created_at)}
          </p>
        </div>
        <StatusPill color={log.source === "admin" ? "rose" : "sky"}>
          {log.source === "admin" ? "Admin" : "Web"}
        </StatusPill>
      </div>
      <MetadataDetails metadata={log.metadata} />
      {recipients.length > 0 ? (
        <div className="mt-4">
          <SentRecipients recipients={recipients} />
        </div>
      ) : null}
    </div>
  );
}

export default function AuditLogClient() {
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Filters
  const [selectedActions, setSelectedActions] = useState(DEFAULT_ACTION_VALUES);
  const [actorFilter, setActorFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([
    ...SOURCE_VALUES,
  ]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [openFilterDropdown, setOpenFilterDropdown] =
    useState<FilterDropdownKey | null>(null);

  const fetchLogs = useCallback(async () => {
    if (selectedActions.length === 0 || selectedSources.length === 0) {
      setLogs([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedActions.length !== ACTION_VALUES.length) {
        selectedActions.forEach((action) => params.append("action", action));
      }
      if (actorFilter) params.set("actor", actorFilter);
      if (targetFilter) params.set("targetEmail", targetFilter);
      if (eventFilter) params.set("eventName", eventFilter);
      if (selectedSources.length !== SOURCE_VALUES.length) {
        selectedSources.forEach((source) => params.append("source", source));
      }
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setExpandedItems([]);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [
    actorFilter,
    endDate,
    eventFilter,
    page,
    selectedActions,
    selectedSources,
    startDate,
    targetFilter,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleTextFilter(setter: (v: string) => void, value: string) {
    setPage(0);
    setter(value);
  }

  function toggleExpandedItem(id: string) {
    setExpandedItems((current) =>
      current.includes(id)
        ? current.filter((entryId) => entryId !== id)
        : [...current, id],
    );
  }

  function resetFilters() {
    setSelectedActions(DEFAULT_ACTION_VALUES);
    setActorFilter("");
    setTargetFilter("");
    setEventFilter("");
    setSelectedSources([...SOURCE_VALUES]);
    setStartDate("");
    setEndDate("");
    setPage(0);
  }

  const actionFilterSummary = selectionsMatch(
    selectedActions,
    DEFAULT_ACTION_VALUES,
  )
    ? "All except high-volume user actions (signups, ticket claims, waitlist joins, mailing list subscriptions, and submissions)"
    : summarizeSelection(
        ACTION_FILTER_OPTIONS,
        selectedActions,
        "All actions",
        "No actions",
      );
  const sourceFilterSummary = summarizeSelection(
    SOURCE_FILTER_OPTIONS,
    selectedSources,
    "All sources",
    "No sources",
  );

  const hasCustomFilters =
    !selectionsMatch(selectedActions, DEFAULT_ACTION_VALUES) ||
    actorFilter ||
    targetFilter ||
    eventFilter ||
    !selectionsMatch(selectedSources, SOURCE_VALUES) ||
    startDate ||
    endDate;
  const isFiltered =
    selectedActions.length !== ACTION_VALUES.length ||
    actorFilter ||
    targetFilter ||
    eventFilter ||
    selectedSources.length !== SOURCE_VALUES.length ||
    startDate ||
    endDate;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!filterDropdownRef.current?.contains(event.target as Node)) {
        setOpenFilterDropdown(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenFilterDropdown(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <PageHeader
        title="Audit log"
        subtitle="Track all admin and user actions across the platform."
      />

      {/* Filters */}
      <div ref={filterDropdownRef}>
        <Card as="div" className="p-4 sm:p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Filters</h3>
              <p className="text-xs text-zinc-500">
                Use dropdowns with checkboxes to narrow the audit log
              </p>
            </div>
            {hasCustomFilters ? (
              <Button
                variant="ghost"
                onClick={resetFilters}
                className="text-xs"
              >
                Reset filters
              </Button>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FilterDropdown
                title="Action"
                summary={actionFilterSummary}
                isOpen={openFilterDropdown === "action"}
                options={ACTION_FILTER_OPTIONS}
                selectedValues={selectedActions}
                onToggle={() =>
                  setOpenFilterDropdown((current) =>
                    current === "action" ? null : "action",
                  )
                }
                onToggleValue={(value) => {
                  setSelectedActions((current) =>
                    toggleSelection(current, value, ACTION_VALUES),
                  );
                  setPage(0);
                }}
                onSelectAll={() => {
                  setSelectedActions(ACTION_VALUES);
                  setPage(0);
                }}
                onClear={() => {
                  setSelectedActions([]);
                  setPage(0);
                }}
              />
              <FilterDropdown
                title="Source"
                summary={sourceFilterSummary}
                isOpen={openFilterDropdown === "source"}
                options={SOURCE_FILTER_OPTIONS}
                selectedValues={selectedSources}
                onToggle={() =>
                  setOpenFilterDropdown((current) =>
                    current === "source" ? null : "source",
                  )
                }
                onToggleValue={(value) => {
                  setSelectedSources((current) =>
                    toggleSelection(current, value, SOURCE_VALUES),
                  );
                  setPage(0);
                }}
                onSelectAll={() => {
                  setSelectedSources([...SOURCE_VALUES]);
                  setPage(0);
                }}
                onClear={() => {
                  setSelectedSources([]);
                  setPage(0);
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Actor */}
              <div>
                <Label htmlFor="audit-actor" className="mb-1 block">
                  Actor
                </Label>
                <Input
                  id="audit-actor"
                  type="text"
                  value={actorFilter}
                  onChange={(e) =>
                    handleTextFilter(setActorFilter, e.target.value)
                  }
                  placeholder="Who did it..."
                />
              </div>

              {/* Target */}
              <div>
                <Label htmlFor="audit-target" className="mb-1 block">
                  Target
                </Label>
                <Input
                  id="audit-target"
                  type="text"
                  value={targetFilter}
                  onChange={(e) =>
                    handleTextFilter(setTargetFilter, e.target.value)
                  }
                  placeholder="Done to whom..."
                />
              </div>

              {/* Event */}
              <div>
                <Label htmlFor="audit-event" className="mb-1 block">
                  Event
                </Label>
                <Input
                  id="audit-event"
                  type="text"
                  value={eventFilter}
                  onChange={(e) =>
                    handleTextFilter(setEventFilter, e.target.value)
                  }
                  placeholder="Which event..."
                />
              </div>

              {/* Start date */}
              <div>
                <Label htmlFor="audit-from" className="mb-1 block">
                  From
                </Label>
                <Input
                  id="audit-from"
                  type="date"
                  value={startDate}
                  onChange={(e) =>
                    handleTextFilter(setStartDate, e.target.value)
                  }
                  className="[color-scheme:dark]"
                />
              </div>

              {/* End date */}
              <div>
                <Label htmlFor="audit-to" className="mb-1 block">
                  To
                </Label>
                <Input
                  id="audit-to"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleTextFilter(setEndDate, e.target.value)}
                  className="[color-scheme:dark]"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Results count + pagination info */}
      <div className="flex items-center justify-between">
        <p className="text-zinc-500 text-sm tabular-nums">
          {total === 0
            ? "No entries found"
            : `Showing ${showingFrom}\u2013${showingTo} of ${total}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 disabled:cursor-not-allowed"
            >
              Previous
            </Button>
            <span className="text-zinc-500 text-sm tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 disabled:cursor-not-allowed"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <TableScroll>
        <Table>
          <THead>
            <TR className="border-b border-white/10">
              <TH className="px-3">Time</TH>
              <TH className="px-3">Action</TH>
              <TH className="px-3">Actor</TH>
              <TH className="px-3">Event</TH>
              <TH className="px-3">Target</TH>
              <TH className="px-3">Source</TH>
              <TH className="px-3">Details</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TR key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TD key={j} className="px-3 py-2">
                      <div className="h-3.5 bg-white/5 rounded animate-pulse" />
                    </TD>
                  ))}
                </TR>
              ))
            ) : logs.length === 0 ? (
              <TR>
                <TD
                  colSpan={7}
                  className="px-3 py-12 text-center text-zinc-500"
                >
                  {isFiltered
                    ? "No entries match your filters."
                    : "No audit log entries yet."}
                </TD>
              </TR>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedItems.includes(log.id);
                const summary = getDetailsSummary(log);

                return (
                  <Fragment key={log.id}>
                    <TR
                      onClick={() => toggleExpandedItem(log.id)}
                      className="cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <TD
                        className="px-3 py-1.5 text-xs text-zinc-400 whitespace-nowrap"
                        title={formatTimestamp(log.created_at)}
                      >
                        {timeAgo(log.created_at)}
                      </TD>
                      <TD className="px-3 py-1.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getActionColor(log.action)}`}
                        >
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        {isAuditLogGroup(log) ? (
                          (() => {
                            const recipientCount =
                              getMetadataRecipients(log.metadata).length ||
                              getMetadataNumber(log.metadata, "sent");
                            return recipientCount > 0 ? (
                              <span
                                className="ml-2 text-[11px] tabular-nums text-zinc-500"
                                title={`${recipientCount.toLocaleString()} recipients`}
                              >
                                {recipientCount.toLocaleString()} recipients
                              </span>
                            ) : null;
                          })()
                        ) : null}
                      </TD>
                      <TD
                        className="px-3 py-1.5 text-xs text-zinc-300 max-w-[180px] truncate"
                        title={log.actor}
                      >
                        {log.actor}
                      </TD>
                      <TD
                        className="px-3 py-1.5 text-xs text-zinc-400 max-w-[160px] truncate"
                        title={log.event_name ?? undefined}
                      >
                        {log.event_name || "\u2014"}
                      </TD>
                      <TD
                        className="px-3 py-1.5 text-xs text-zinc-400 max-w-[180px] truncate"
                        title={log.target_email ?? undefined}
                      >
                        {log.target_email || "\u2014"}
                      </TD>
                      <TD className="px-3 py-1.5">
                        <StatusPill
                          color={log.source === "admin" ? "rose" : "sky"}
                        >
                          {log.source === "admin" ? "Admin" : "Web"}
                        </StatusPill>
                      </TD>
                      <TD className="px-3 py-1.5 max-w-[260px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpandedItem(log.id);
                          }}
                          className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1 text-left ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
                          title={summary}
                        >
                          <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">
                            {summary}
                          </span>
                          <ChevronDownIcon
                            className={`size-4 shrink-0 text-zinc-500 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      </TD>
                    </TR>
                    {isExpanded ? (
                      <TR className="bg-zinc-950/40">
                        <TD colSpan={7} className="px-3 py-3">
                          <ExpandedDetails log={log} />
                        </TD>
                      </TR>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </TBody>
        </Table>
      </TableScroll>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 disabled:cursor-not-allowed"
            >
              Previous
            </Button>
            <span className="text-zinc-500 text-sm tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 disabled:cursor-not-allowed"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
