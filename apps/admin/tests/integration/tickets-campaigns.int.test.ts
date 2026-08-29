import { afterAll, afterEach, describe, expect, test } from "bun:test";

import {
  cleanup,
  closeTestDatabase,
  getTestDatabase,
  makeCampaign,
  makeEvent,
  makeTicket,
  makeWaitlistEntry,
  testEmail,
} from "../helpers/factories";

const integration =
  process.env.TEST_INTEGRATION === "1" ? describe : describe.skip;

integration("admin ticket and campaign database contracts", () => {
  afterEach(cleanup);
  afterAll(closeTestDatabase);

  test("canceling through the shared RPC archives and promotes", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 1 });
    const canceledEmail = testEmail("admin-cancel");
    const promotedEmail = testEmail("admin-promote");
    const ticket = await makeTicket({
      eventId: event.id,
      email: canceledEmail,
    });
    await makeWaitlistEntry({ eventId: event.id, email: promotedEmail });

    await sql`select public.cancel_ticket_and_promote(
      ${event.id}::uuid, ${canceledEmail}
    )`;
    const [archived] = await sql`
      select email from canceled_tickets where original_ticket_id = ${ticket.id}
    `;
    const [promoted] = await sql`
      select email from tickets where event_id = ${event.id}
    `;

    expect(archived.email).toBe(canceledEmail);
    expect(promoted.email).toBe(promotedEmail);
  });

  test("campaign fixtures round-trip draft and sent state", async () => {
    const sql = getTestDatabase();
    const campaign = await makeCampaign({ subject: "State machine test" });
    await sql`
      update email_campaigns set status = 'sent', sent_at = now()
      where id = ${campaign.id}
    `;
    const [sent] = await sql`
      select status, sent_at from email_campaigns where id = ${campaign.id}
    `;

    expect(sent.status).toBe("sent");
    expect(sent.sent_at).toBeInstanceOf(Date);
  });
});
