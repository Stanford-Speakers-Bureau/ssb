import { afterAll, afterEach, describe, expect, test } from "bun:test";

import {
  cleanup,
  closeTestDatabase,
  getTestDatabase,
  makeEvent,
  makeTicket,
  testEmail,
} from "../helpers/factories";

const integration =
  process.env.TEST_INTEGRATION === "1" ? describe : describe.skip;

async function captureDatabaseError(query: PromiseLike<unknown>) {
  try {
    await query;
    return null;
  } catch (error) {
    return error;
  }
}

integration("waitlist ordering and scan counters", () => {
  afterEach(cleanup);
  afterAll(closeTestDatabase);

  test("joins a sold-out waitlist with canonical email and sequential positions", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 1 });
    await makeTicket({ eventId: event.id });
    const first = testEmail("first-waitlist");
    const second = testEmail("second-waitlist");

    const [firstResult] = await sql`
      select public.join_waitlist_with_name(
        ${event.id}::uuid, ${null}, ${"First"}, ${`  ${first.toUpperCase()}  `}
      ) as result
    `;
    const [secondResult] = await sql`
      select public.join_waitlist_with_name(
        ${event.id}::uuid, ${null}, ${"Second"}, ${second}
      ) as result
    `;
    const rows = await sql`
      select email, position::int from waitlist
      where event_id = ${event.id} order by position
    `;

    expect(firstResult.result.position).toBe(1);
    expect(secondResult.result.position).toBe(2);
    expect(Array.from(rows)).toEqual([
      { email: first, position: 1 },
      { email: second, position: 2 },
    ]);
  });

  test("rejects duplicate waitlist membership", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 1 });
    await makeTicket({ eventId: event.id });
    const email = testEmail("duplicate-waitlist");
    await sql`select public.join_waitlist_with_name(
      ${event.id}::uuid, ${null}, ${"First"}, ${email}
    )`;

    const error = await captureDatabaseError(sql`
      select public.join_waitlist_with_name(
        ${event.id}::uuid, ${null}, ${"Again"}, ${email}
      )
    `);
    expect(String(error)).toMatch(/already.*waitlist/i);
  });

  test("leaving compacts all later waitlist positions", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 1 });
    await makeTicket({ eventId: event.id });
    const first = testEmail("leaving");
    const second = testEmail("remaining");
    await sql`select public.join_waitlist_with_name(${event.id}::uuid, ${null}, ${"First"}, ${first})`;
    await sql`select public.join_waitlist_with_name(${event.id}::uuid, ${null}, ${"Second"}, ${second})`;

    const [left] = await sql`
      select public.leave_waitlist(${event.id}::uuid, ${first}) as result
    `;
    const [remaining] = await sql`
      select email, position::int from waitlist where event_id = ${event.id}
    `;

    expect(left.result.success).toBe(true);
    expect(remaining).toEqual({ email: second, position: 1 });
  });

  test("standby mode closes the online waitlist", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ capacity: 1, standbyEnabled: true });
    const error = await captureDatabaseError(sql`
      select public.join_waitlist_with_name(
        ${event.id}::uuid, ${null}, ${"Standby"}, ${testEmail("standby")}
      )
    `);
    expect(String(error)).toMatch(/waitlist_closed/i);
  });

  test("ticket scanned trigger increments once and unscan decrements", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent();
    const ticket = await makeTicket({ eventId: event.id });

    await sql`update tickets set scanned = true where id = ${ticket.id}`;
    await sql`update tickets set scanned = true where id = ${ticket.id}`;
    const [afterScan] = await sql`
      select scanned::int from events where id = ${event.id}
    `;
    await sql`update tickets set scanned = false where id = ${ticket.id}`;
    const [afterUnscan] = await sql`
      select scanned::int from events where id = ${event.id}
    `;

    expect(afterScan.scanned).toBe(1);
    expect(afterUnscan.scanned).toBe(0);
  });
});
