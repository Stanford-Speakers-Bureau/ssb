export type AuditLogEntry = {
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

export type AuditLogGroup = {
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
  failures: AuditLogEntry[];
};

export type AuditLogItem = AuditLogEntry | AuditLogGroup;

export type AuditLogRow = {
  id: string;
  createdAt: Date;
  action: string;
  actor: string;
  source: string;
  eventId: string | null;
  eventName: string | null;
  targetEmail: string | null;
  metadata: string | null;
};

export function parseAuditMetadata(
  metadata: string | null,
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return { value: parsed };
  } catch (error) {
    console.error("[audit] Failed to parse metadata:", error);
    return { raw: metadata };
  }
}

export function toAuditLogEntry(log: AuditLogRow): AuditLogEntry {
  return {
    kind: "log",
    id: log.id,
    created_at: log.createdAt.toISOString(),
    action: log.action,
    actor: log.actor,
    source: log.source,
    event_id: log.eventId,
    event_name: log.eventName,
    target_email: log.targetEmail,
    metadata: parseAuditMetadata(log.metadata),
  };
}

// Mass sends that fan out into multiple per-chunk audit rows sharing a batchId.
// Classic bulk sends (email.send_mass) and campaign sends (campaign.send, logged
// once per chunk) both get folded into a single grouped row keyed by batchId.
const GROUPABLE_MASS_SEND_ACTIONS = new Set([
  "email.send_mass",
  "campaign.send",
]);

function getMassEmailBatchId(
  action: string,
  metadata: Record<string, unknown> | null,
): string | null {
  if (!GROUPABLE_MASS_SEND_ACTIONS.has(action)) {
    return null;
  }

  const batchId = metadata?.batchId;
  return typeof batchId === "string" && batchId.trim().length > 0
    ? batchId.trim()
    : null;
}

function getFailureBatchId(
  action: string,
  metadata: Record<string, unknown> | null,
): string | null {
  if (action !== "email.send_failed") {
    return null;
  }
  const batchId = metadata?.batchId;
  return typeof batchId === "string" && batchId.trim().length > 0
    ? batchId.trim()
    : null;
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

export function getMetadataRecipients(
  metadata: Record<string, unknown> | null,
): string[] {
  const value = metadata?.recipients;
  if (!Array.isArray(value)) return [];
  return value.filter((email): email is string => typeof email === "string");
}

export function summarizeMassEmailMetadata(
  batchId: string,
  entries: AuditLogEntry[],
): Record<string, unknown> | null {
  // Merge each chunk's recipient list into one deduped roster for the batch.
  const recipients = Array.from(
    new Set(entries.flatMap((entry) => getMetadataRecipients(entry.metadata))),
  );
  const primaryMetadata =
    entries.find((entry) => entry.metadata)?.metadata ?? null;
  if (!primaryMetadata) {
    return {
      batchId,
      recipients,
      recipientCount: recipients.length,
    };
  }

  const sent = entries.reduce(
    (sum, entry) => sum + getMetadataNumber(entry.metadata, "sent"),
    0,
  );
  const failed = entries.reduce(
    (sum, entry) => sum + getMetadataNumber(entry.metadata, "failed"),
    0,
  );
  const skipped = entries.reduce(
    (sum, entry) => sum + getMetadataNumber(entry.metadata, "skipped"),
    0,
  );
  const skippedHasTicket = entries.reduce(
    (sum, entry) => sum + getMetadataNumber(entry.metadata, "skippedHasTicket"),
    0,
  );
  const skippedOptedOut = entries.reduce(
    (sum, entry) => sum + getMetadataNumber(entry.metadata, "skippedOptedOut"),
    0,
  );
  const suppressed = entries.reduce(
    (sum, entry) => sum + getMetadataNumber(entry.metadata, "suppressed"),
    0,
  );
  const explicitTotal = entries.reduce(
    (sum, entry) => sum + getMetadataNumber(entry.metadata, "total"),
    0,
  );

  return {
    ...primaryMetadata,
    batchId,
    sent,
    failed,
    skipped,
    skippedHasTicket,
    skippedOptedOut,
    suppressed,
    total:
      explicitTotal > 0 ? explicitTotal : sent + failed + skipped + suppressed,
    recipients,
    recipientCount: recipients.length,
  };
}

function buildMassEmailGroup(
  batchId: string,
  entries: AuditLogEntry[],
  failures: AuditLogEntry[],
): AuditLogItem {
  if (entries.length === 1 && failures.length === 0) {
    return entries[0];
  }

  const firstEntry = entries[0];

  return {
    kind: "group",
    id: `mass-email:${batchId}`,
    created_at: firstEntry.created_at,
    action: firstEntry.action,
    actor: firstEntry.actor,
    source: firstEntry.source,
    event_id: firstEntry.event_id,
    event_name: firstEntry.event_name,
    target_email: null,
    metadata: summarizeMassEmailMetadata(batchId, entries),
    entries,
    group_count: entries.length,
    failures,
  };
}

export function groupAuditLogs(logs: AuditLogRow[]): AuditLogItem[] {
  const groupedEntries = new Map<string, AuditLogEntry[]>();
  const failuresByBatch = new Map<string, AuditLogEntry[]>();
  const orderedItems: Array<
    { kind: "log"; entry: AuditLogEntry } | { kind: "batch"; batchId: string }
  > = [];

  // First pass: collect failures by batchId so we can attach them to their
  // mass-email parent rather than render them as individual rows.
  const allEntries: AuditLogEntry[] = [];
  for (const log of logs) {
    const entry = toAuditLogEntry(log);
    allEntries.push(entry);
    const failureBatchId = getFailureBatchId(entry.action, entry.metadata);
    if (failureBatchId) {
      const existing = failuresByBatch.get(failureBatchId);
      if (existing) {
        existing.push(entry);
      } else {
        failuresByBatch.set(failureBatchId, [entry]);
      }
    }
  }

  for (const entry of allEntries) {
    const massBatchId = getMassEmailBatchId(entry.action, entry.metadata);
    if (massBatchId) {
      const existingEntries = groupedEntries.get(massBatchId);
      if (existingEntries) {
        existingEntries.push(entry);
        continue;
      }
      groupedEntries.set(massBatchId, [entry]);
      orderedItems.push({ kind: "batch", batchId: massBatchId });
      continue;
    }

    // Skip per-recipient send_failed rows that belong to a mass-email batch
    // visible on this page. They're folded into the group's expanded view.
    const failureBatchId = getFailureBatchId(entry.action, entry.metadata);
    if (failureBatchId && failuresByBatch.has(failureBatchId)) {
      continue;
    }

    orderedItems.push({ kind: "log", entry });
  }

  return orderedItems.map((item) =>
    item.kind === "log"
      ? item.entry
      : buildMassEmailGroup(
          item.batchId,
          groupedEntries.get(item.batchId) ?? [],
          failuresByBatch.get(item.batchId) ?? [],
        ),
  );
}
