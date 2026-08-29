import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { logAuditEvent } from "@/app/lib/audit";
import {
  getSuppressedSet,
  logSendFailures,
  partitionBySuppression,
} from "@/app/lib/email-suppression";
import {
  cleanup,
  closeTestDatabase,
  getTestDatabase,
  grantRole,
  makeCampaign,
  makeEvent,
  registerCleanup,
  testEmail,
} from "../helpers/factories";

const integration =
  process.env.TEST_INTEGRATION === "1" ? describe : describe.skip;

integration("admin campaign, suppression, and audit database contracts", () => {
  afterEach(cleanup);
  afterAll(closeTestDatabase);

  test("campaign send checkpoint fields round-trip", async () => {
    const sql = getTestDatabase();
    const campaign = await makeCampaign();
    const batchId = `batch-${campaign.id}`;

    await sql`
      update email_campaigns
      set status = 'sending', recipient_count = 25, failed_count = 2,
          send_batch_id = ${batchId}, last_processed_chunk_index = 3
      where id = ${campaign.id}
    `;
    const [checkpoint] = await sql`
      select status, recipient_count::int, failed_count::int, send_batch_id,
             last_processed_chunk_index
      from email_campaigns where id = ${campaign.id}
    `;

    expect(checkpoint).toEqual({
      status: "sending",
      recipient_count: 25,
      failed_count: 2,
      send_batch_id: batchId,
      last_processed_chunk_index: 3,
    });
  });

  test("deleting an event preserves its campaign while clearing the scope", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent();
    const campaign = await makeCampaign({ eventId: event.id });

    await sql`delete from events where id = ${event.id}`;
    const [preserved] = await sql`
      select event_id from email_campaigns where id = ${campaign.id}
    `;

    expect(preserved).toEqual({ event_id: null });
  });

  test("suppression lookup parses comma-separated roles and partitions in order", async () => {
    const blocked = testEmail("blocked");
    const allowed = testEmail("allowed");
    await grantRole(blocked, "scanner, email_suppression");

    expect(
      await getSuppressedSet([` ${blocked.toUpperCase()} `, allowed]),
    ).toEqual(new Set([blocked]));
    expect(
      await partitionBySuppression([allowed, blocked.toUpperCase(), allowed]),
    ).toEqual({
      sendable: [allowed, allowed],
      suppressed: [blocked.toUpperCase()],
    });
  });

  test("audit logging persists structured context", async () => {
    const sql = getTestDatabase();
    const actor = testEmail("audit-actor");
    const target = testEmail("audit-target");
    const event = await makeEvent();
    registerCleanup(() => sql`delete from audit_logs where actor = ${actor}`);

    await logAuditEvent({
      action: "ticket.update_type",
      actor,
      eventId: event.id,
      eventName: event.name,
      targetEmail: target,
      metadata: { from: "STANDARD", to: "VIP" },
    });
    const [row] = await sql`
      select action, actor, source, event_id, target_email, metadata
      from audit_logs where actor = ${actor}
    `;

    expect(row).toMatchObject({
      action: "ticket.update_type",
      actor,
      source: "admin",
      event_id: event.id,
      target_email: target,
    });
    expect(JSON.parse(row.metadata)).toEqual({ from: "STANDARD", to: "VIP" });
  });

  test("send failures produce one bounded audit row per recipient", async () => {
    const sql = getTestDatabase();
    const actor = testEmail("failure-actor");
    const first = testEmail("failure-one");
    const second = testEmail("failure-two");
    const batchId = `failures-${Date.now()}`;
    registerCleanup(() => sql`delete from audit_logs where actor = ${actor}`);

    await logSendFailures({
      failures: [
        { email: first, error: new Error("x".repeat(700)) },
        { email: second, error: "SES rejected" },
      ],
      actor,
      source: "integration-test",
      batchId,
    });
    const rows = await sql`
      select target_email, metadata from audit_logs
      where actor = ${actor} order by target_email
    `;
    const parsed = Array.from(rows).map((row) => ({
      email: row.target_email,
      metadata: JSON.parse(row.metadata),
    }));

    expect(parsed).toHaveLength(2);
    expect(parsed.map((row) => row.email)).toEqual([first, second].sort());
    expect(parsed[0].metadata).toMatchObject({
      source: "integration-test",
      batchId,
    });
    expect(parsed[0].metadata.error).toHaveLength(500);
    expect(parsed[1].metadata.error).toBe("SES rejected");
  });
});
