import { describe, expect, test } from "bun:test";
import {
  getMetadataRecipients,
  groupAuditLogs,
  summarizeMassEmailMetadata,
  type AuditLogEntry,
  type AuditLogRow,
} from "../audit-log-groups";

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

function logRow(
  id: string,
  action: string,
  metadata: Record<string, unknown> | null,
): AuditLogRow {
  return {
    id,
    createdAt: CREATED_AT,
    action,
    actor: "admin@stanford.edu",
    source: "admin",
    eventId: "event-1",
    eventName: "Event One",
    targetEmail: null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  };
}

function entry(metadata: Record<string, unknown> | null): AuditLogEntry {
  return {
    kind: "log",
    id: crypto.randomUUID(),
    created_at: CREATED_AT.toISOString(),
    action: "email.send_mass",
    actor: "admin@stanford.edu",
    source: "admin",
    event_id: "event-1",
    event_name: "Event One",
    target_email: null,
    metadata,
  };
}

describe("getMetadataRecipients", () => {
  test("returns only string recipient values", () => {
    expect(
      getMetadataRecipients({
        recipients: [
          "a@example.com",
          null,
          42,
          "b@example.com",
          { email: "c@example.com" },
        ],
      }),
    ).toEqual(["a@example.com", "b@example.com"]);
  });

  test("returns an empty array when recipients is absent or not an array", () => {
    expect(getMetadataRecipients(null)).toEqual([]);
    expect(getMetadataRecipients({ recipients: "a@example.com" })).toEqual([]);
  });
});

describe("summarizeMassEmailMetadata", () => {
  test("dedupes recipients across chunks and sums delivery counters", () => {
    const summary = summarizeMassEmailMetadata("batch-1", [
      entry({
        batchId: "batch-1",
        sent: 2,
        failed: "1",
        skipped: 1,
        skippedHasTicket: "1",
        skippedOptedOut: 0,
        suppressed: 1,
        total: 5,
        recipients: ["a@example.com", "b@example.com"],
      }),
      entry({
        batchId: "batch-1",
        sent: "3",
        failed: 0,
        skipped: "2",
        skippedHasTicket: 0,
        skippedOptedOut: 2,
        suppressed: "0",
        total: "5",
        recipients: ["b@example.com", "c@example.com"],
      }),
    ]);

    expect(summary).toMatchObject({
      batchId: "batch-1",
      sent: 5,
      failed: 1,
      skipped: 3,
      skippedHasTicket: 1,
      skippedOptedOut: 2,
      suppressed: 1,
      total: 10,
      recipients: ["a@example.com", "b@example.com", "c@example.com"],
      recipientCount: 3,
    });
  });

  test("falls back to computed total when no explicit total is present", () => {
    const summary = summarizeMassEmailMetadata("batch-2", [
      entry({ sent: 3, failed: 1, skipped: 2, suppressed: 1 }),
    ]);

    expect(summary?.total).toBe(7);
  });
});

describe("groupAuditLogs", () => {
  test("groups mass email chunks, dedupes recipients, and folds failures", () => {
    const grouped = groupAuditLogs([
      logRow("chunk-1", "email.send_mass", {
        batchId: "batch-1",
        sent: 2,
        failed: 0,
        recipients: ["a@example.com", "b@example.com"],
      }),
      logRow("failure-1", "email.send_failed", {
        batchId: "batch-1",
        recipient: "c@example.com",
        error: "SES throttled",
      }),
      logRow("chunk-2", "email.send_mass", {
        batchId: "batch-1",
        sent: 1,
        failed: 1,
        recipients: ["b@example.com", "c@example.com"],
      }),
      logRow("single", "ticket.get", { ticketId: "ticket-1" }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({
      kind: "group",
      id: "mass-email:batch-1",
      group_count: 2,
      failures: [{ id: "failure-1" }],
      metadata: {
        sent: 3,
        failed: 1,
        recipients: ["a@example.com", "b@example.com", "c@example.com"],
        recipientCount: 3,
      },
    });
    expect(grouped[1]).toMatchObject({
      kind: "log",
      id: "single",
      action: "ticket.get",
    });
  });
});
