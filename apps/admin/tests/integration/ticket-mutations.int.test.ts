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

integration("admin ticket mutation database contracts", () => {
  afterEach(cleanup);
  afterAll(closeTestDatabase);

  test("name, title, and ticket type edits persist and rebalance counters", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent();
    const ticket = await makeTicket({ eventId: event.id, type: "STANDARD" });

    await sql`
      update tickets
      set name = 'Renamed Attendee', title = 'Guest Speaker', type = 'VIP'
      where id = ${ticket.id}
    `;

    const [updated] = await sql`
      select name, title, type from tickets where id = ${ticket.id}
    `;
    const [counts] = await sql`
      select tickets::int, public_tickets_sold::int, vip_tickets_sold::int
      from events where id = ${event.id}
    `;

    expect(updated).toEqual({
      name: "Renamed Attendee",
      title: "Guest Speaker",
      type: "VIP",
    });
    expect(counts).toEqual({
      tickets: 1,
      public_tickets_sold: 0,
      vip_tickets_sold: 1,
    });
  });

  test("scan and unscan keep current and legacy event counters aligned", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent();
    const ticket = await makeTicket({ eventId: event.id });

    await sql`update tickets set scanned = true where id = ${ticket.id}`;
    const [afterScan] = await sql`
      select scanned::int, scanned_count::int from events where id = ${event.id}
    `;
    await sql`update tickets set scanned = false where id = ${ticket.id}`;
    const [afterUnscan] = await sql`
      select scanned::int, scanned_count::int from events where id = ${event.id}
    `;

    expect(afterScan).toEqual({ scanned: 1, scanned_count: 1 });
    expect(afterUnscan).toEqual({ scanned: 0, scanned_count: 0 });
  });

  test("a scanned ticket cannot be canceled or promote the waitlist", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 1 });
    const ownerEmail = testEmail("scanned-owner");
    const waitingEmail = testEmail("scanned-waiting");
    const ticket = await makeTicket({ eventId: event.id, email: ownerEmail });
    await makeWaitlistEntry({ eventId: event.id, email: waitingEmail });
    await sql`update tickets set scanned = true where id = ${ticket.id}`;

    await expectDatabaseError(
      sql`select public.cancel_ticket_and_promote(${event.id}::uuid, ${ownerEmail})`,
      /already_scanned/,
    );

    const [owner] = await sql`
      select scanned from tickets where id = ${ticket.id}
    `;
    const [waiting] = await sql`
      select position::int from waitlist
      where event_id = ${event.id} and email = ${waitingEmail}
    `;
    expect(owner.scanned).toBe(true);
    expect(waiting.position).toBe(1);
  });

  test("cancellation promotes only the first waitlist entry and compacts the rest", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 1 });
    const ownerEmail = testEmail("fifo-owner");
    const firstEmail = testEmail("fifo-first");
    const secondEmail = testEmail("fifo-second");
    await makeTicket({ eventId: event.id, email: ownerEmail });
    await makeWaitlistEntry({
      eventId: event.id,
      email: firstEmail,
      position: 1,
    });
    await makeWaitlistEntry({
      eventId: event.id,
      email: secondEmail,
      position: 2,
    });

    await sql`select public.cancel_ticket_and_promote(${event.id}::uuid, ${ownerEmail})`;

    const promoted = await sql`
      select email from tickets where event_id = ${event.id} order by created_at
    `;
    const remaining = await sql`
      select email, position::int from waitlist where event_id = ${event.id}
    `;
    expect(Array.from(promoted)).toEqual([{ email: firstEmail }]);
    expect(Array.from(remaining)).toEqual([
      { email: secondEmail, position: 1 },
    ]);
  });
});
