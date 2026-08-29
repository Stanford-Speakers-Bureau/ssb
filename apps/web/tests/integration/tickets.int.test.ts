import { afterAll, afterEach, describe, expect, test } from "bun:test";

import {
  cleanup,
  closeTestDatabase,
  getTestDatabase,
  makeEvent,
  makeTicket,
  makeWaitlistEntry,
  testEmail,
} from "../helpers/factories";

const integration =
  process.env.TEST_INTEGRATION === "1" ? describe : describe.skip;

async function expectDatabaseError(
  query: PromiseLike<unknown>,
  pattern: RegExp,
): Promise<void> {
  let caught: unknown;
  try {
    await query;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(String(caught)).toMatch(pattern);
}

integration("ticket and waitlist database contracts", () => {
  afterEach(cleanup);
  afterAll(closeTestDatabase);

  test("creates a ticket atomically and updates the event counter", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 2 });
    const email = testEmail("buyer");

    const [created] = await sql`
      select public.create_ticket_with_name(
        ${event.id}::uuid, ${null}, ${"Test Buyer"}, ${email}
      ) as result
    `;
    const [stored] = await sql`
      select email, name, type from tickets
      where event_id = ${event.id} and email = ${email}
    `;
    const [counter] = await sql`
      select public_tickets_sold from events where id = ${event.id}
    `;

    expect(created.result.success).toBe(true);
    expect(stored).toMatchObject({
      email,
      name: "Test Buyer",
      type: "STANDARD",
    });
    expect(Number(counter.public_tickets_sold)).toBe(1);
  });

  test("rejects a duplicate without changing counters", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 2 });
    const email = testEmail("duplicate");
    await sql`select public.create_ticket_with_name(${event.id}::uuid, ${null}, ${"First"}, ${email})`;

    await expectDatabaseError(
      sql`select public.create_ticket_with_name(${event.id}::uuid, ${null}, ${"Second"}, ${email})`,
      /already/i,
    );

    const [counts] = await sql`
      select count(*)::int as rows, max(public_tickets_sold)::int as sold
      from tickets cross join events
      where tickets.event_id = ${event.id} and events.id = ${event.id}
    `;
    expect(counts).toMatchObject({ rows: 1, sold: 1 });
  });

  test("enforces capacity under the database lock", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 1 });
    const first = testEmail("capacity");
    const second = testEmail("capacity");
    await sql`select public.create_ticket_with_name(${event.id}::uuid, ${null}, ${"First"}, ${first})`;

    await expectDatabaseError(
      sql`select public.create_ticket_with_name(${event.id}::uuid, ${null}, ${"Second"}, ${second})`,
      /capacity/i,
    );
  });

  test("VIP overflow reduces the remaining public allocation", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 5, reserved: 2 });
    await makeTicket({ eventId: event.id, type: "VIP" });
    await makeTicket({ eventId: event.id, type: "VIP" });
    await makeTicket({ eventId: event.id, type: "VIP" });

    await sql`select public.create_ticket_with_name(
      ${event.id}::uuid, ${null}, ${"Public One"}, ${testEmail("public-one")}
    )`;
    await sql`select public.create_ticket_with_name(
      ${event.id}::uuid, ${null}, ${"Public Two"}, ${testEmail("public-two")}
    )`;
    await expectDatabaseError(
      sql`select public.create_ticket_with_name(
        ${event.id}::uuid, ${null}, ${"Public Three"}, ${testEmail("public-three")}
      )`,
      /capacity/i,
    );

    const [counts] = await sql`
      select public_tickets_sold::int, vip_tickets_sold::int
      from events where id = ${event.id}
    `;
    expect(counts).toEqual({ public_tickets_sold: 2, vip_tickets_sold: 3 });
  });

  test("cancellation archives the ticket and promotes the oldest waitlist entry", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 1 });
    const canceledEmail = testEmail("cancel");
    const promotedEmail = testEmail("promoted");
    const ticket = await makeTicket({
      eventId: event.id,
      email: canceledEmail,
    });
    await makeWaitlistEntry({
      eventId: event.id,
      email: promotedEmail,
      position: 1,
    });

    const [cancellation] = await sql`
      select public.cancel_ticket_and_promote(${event.id}::uuid, ${canceledEmail}) as result
    `;
    const [promoted] = await sql`
      select email, type from tickets where event_id = ${event.id}
    `;
    const [archived] = await sql`
      select original_ticket_id, email, source from canceled_tickets
      where original_ticket_id = ${ticket.id}
    `;

    expect(cancellation.result).toMatchObject({
      success: true,
      promoted: true,
    });
    expect(promoted).toMatchObject({ email: promotedEmail, type: "STANDARD" });
    expect(archived).toMatchObject({
      original_ticket_id: ticket.id,
      email: canceledEmail,
      source: "live",
    });
  });

  test("waitlist rejects users while tickets remain available", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 5 });

    await expectDatabaseError(
      sql`select public.join_waitlist_with_name(
        ${event.id}::uuid, ${null}, ${"Early User"}, ${testEmail("early")}
      )`,
      /not_sold_out/i,
    );
  });
});
