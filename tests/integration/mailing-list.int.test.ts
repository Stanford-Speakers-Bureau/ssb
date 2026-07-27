import { afterAll, afterEach, describe, expect, test } from "bun:test";

import {
  recordMailingListMember,
  recordSelfResubscribe,
  recordSelfUnsubscribe,
} from "@/app/lib/mailing-list";
import {
  cleanup,
  closeTestDatabase,
  getTestDatabase,
  makeEvent,
  registerCleanup,
  testEmail,
} from "../helpers/factories";

const integration =
  process.env.TEST_INTEGRATION === "1" ? describe : describe.skip;

function cleanupEmail(email: string) {
  const sql = getTestDatabase();
  registerCleanup(async () => {
    await sql`delete from audit_logs where target_email = ${email}`;
    await sql`delete from email_unsubscribes where email = ${email}`;
    await sql`delete from mailing_list where email = ${email}`;
  });
}

integration("mailing list and unsubscribe round trips", () => {
  afterEach(cleanup);
  afterAll(closeTestDatabase);

  test("member recording canonicalizes and remains idempotent", async () => {
    const sql = getTestDatabase();
    const email = testEmail("member");
    cleanupEmail(email);

    await recordMailingListMember({
      email: `  ${email.toUpperCase()}  `,
      source: "ticket",
    });
    await recordMailingListMember({ email, source: "waitlist" });
    const rows = await sql`
      select email, display_email, source from mailing_list where email = ${email}
    `;
    const audits = await sql`
      select action from audit_logs
      where target_email = ${email} and action = 'mailing_list.subscribe'
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(email);
    expect(audits).toHaveLength(1);
  });

  test("event unsubscribe is idempotent and resubscribe removes the row", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ name: "Unsubscribe Contract Event" });
    const email = testEmail("unsubscribe");
    cleanupEmail(email);

    const first = await recordSelfUnsubscribe({
      email,
      scope: "event",
      eventId: event.id,
      eventName: event.name,
      source: "integration_test",
    });
    const duplicate = await recordSelfUnsubscribe({
      email,
      scope: "event",
      eventId: event.id,
      eventName: event.name,
      source: "integration_test",
    });
    const removed = await recordSelfResubscribe({
      email,
      scope: "event",
      eventId: event.id,
      eventName: event.name,
    });
    const removedAgain = await recordSelfResubscribe({
      email,
      scope: "event",
      eventId: event.id,
      eventName: event.name,
    });
    const [count] = await sql`
      select count(*)::int from email_unsubscribes
      where email = ${email} and event_id = ${event.id}
    `;

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(removed.removed).toBe(true);
    expect(removedAgain.removed).toBe(false);
    expect(count.count).toBe(0);
  });

  test("event scope requires an event id", async () => {
    await expect(
      recordSelfUnsubscribe({
        email: testEmail("missing-event"),
        scope: "event",
        source: "integration_test",
      }),
    ).rejects.toThrow(/eventId required/);
  });
});
