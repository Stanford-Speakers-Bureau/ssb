import {
  test as anonymousTest,
  expect as anonymousExpect,
} from "@playwright/test";

import { test, expect } from "../fixtures";
import {
  getTestDatabase,
  makeEvent,
  makeTicket,
  registerCleanup,
  testEmail,
} from "../helpers/db";
import { buildEventUnsubscribeLink } from "../../app/lib/unsubscribe-links";

function cleanupEmailSideEffects(email: string): void {
  const sql = getTestDatabase();
  registerCleanup(async () => {
    await sql`delete from mailing_list where email = ${email}`;
    await sql`delete from email_unsubscribes where email = ${email}`;
    await sql`
      delete from audit_logs where actor = ${email} or target_email = ${email}
    `;
  });
}

test("valid referrals purchase successfully while invalid codes do not", async ({
  signedInPage,
  signedInUser,
}) => {
  const sql = getTestDatabase();
  const event = await makeEvent({ name: "Browser Referral Contract" });
  cleanupEmailSideEffects(signedInUser.email);
  await sql`
    insert into referrals (event_id, referral_code, count)
    values (${event.id}, 'ambassador', 0)
  `;

  const invalid = await signedInPage.request.post("/api/tickets", {
    data: { event_id: event.id, referral: "not-a-code" },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    error: expect.stringMatching(/invalid referral/i),
  });

  const valid = await signedInPage.request.post("/api/tickets", {
    data: { event_id: event.id, referral: "AMBASSADOR" },
  });
  expect(valid.status()).toBe(200);
  const [ticket] = await sql`
    select referral from tickets
    where event_id = ${event.id} and email = ${signedInUser.email}
  `;
  expect(ticket.referral).toBe("ambassador");
  await expect
    .poll(async () => {
      const rows = await sql`
        select referral_code, count::int from referrals
        where event_id = ${event.id} and referral_code = 'ambassador'
      `;
      const [userReferral] = await sql`
        select referral_code from referrals
        where event_id = ${event.id}
          and referral_code = ${signedInUser.email.split("@")[0]}
      `;
      return { count: rows[0]?.count ?? null, userReferral: !!userReferral };
    })
    .toEqual({ count: 1, userReferral: true });
});

test("scanner search, scan, and double-scan use the live event", async ({
  scannerPage,
}) => {
  const sql = getTestDatabase();
  const previousLive = await sql`select id from events where live = true`;
  await sql`update events set live = false where live = true`;
  const event = await makeEvent({
    name: "Browser Scanner Contract",
    live: true,
  });
  const attendee = testEmail("scan-attendee");
  const ticket = await makeTicket({
    eventId: event.id,
    email: attendee,
    name: "Searchable Scanner Attendee",
  });
  registerCleanup(async () => {
    await sql`update events set live = false where id = ${event.id}`;
    const ids = Array.from(previousLive, (row) => row.id as string);
    if (ids.length > 0)
      await sql`update events set live = true where id in ${sql(ids)}`;
  });

  const search = await scannerPage.request.get(
    `/api/scan/search?q=${encodeURIComponent("Searchable Scanner")}`,
  );
  expect(search.status()).toBe(200);
  expect((await search.json()).results).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: ticket.id })]),
  );

  const scan = await scannerPage.request.post("/api/scan", {
    data: { ticket_id: ticket.id },
  });
  expect(await scan.json()).toMatchObject({ success: true, status: "scanned" });
  const duplicate = await scannerPage.request.post("/api/scan", {
    data: { ticket_id: ticket.id },
  });
  expect(await duplicate.json()).toMatchObject({
    success: false,
    status: "already_scanned",
  });
});

test("ordinary signed-in users cannot use scanner endpoints", async ({
  signedInPage,
}) => {
  const response = await signedInPage.request.get("/api/scan/search?q=test");
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: "Not authorized" });
});

test("event unsubscribe validates the phrase and supports resubscribe", async ({
  signedInPage,
  signedInUser,
}) => {
  const sql = getTestDatabase();
  const event = await makeEvent({ name: "Browser Unsubscribe Event" });
  cleanupEmailSideEffects(signedInUser.email);
  const link = await buildEventUnsubscribeLink({
    baseUrl: "http://localhost:3100",
    email: signedInUser.email,
    eventId: event.id,
  });
  const token = new URL(link).searchParams.get("token")!;

  const wrongPhrase = await signedInPage.request.post("/api/unsubscribe", {
    data: { token, confirmation: "wrong event" },
  });
  expect(wrongPhrase.status()).toBe(400);
  const unsubscribe = await signedInPage.request.post("/api/unsubscribe", {
    data: { token, confirmation: event.name },
  });
  expect(await unsubscribe.json()).toMatchObject({ ok: true, created: true });
  const [stored] = await sql`
    select scope, event_id from email_unsubscribes
    where email = ${signedInUser.email}
  `;
  expect(stored).toEqual({ scope: "event", event_id: event.id });

  const resubscribe = await signedInPage.request.post(
    "/api/unsubscribe/resubscribe",
    { data: { token } },
  );
  expect(await resubscribe.json()).toMatchObject({ ok: true, removed: true });
});

test("checked-in attendees can submit and reload feedback", async ({
  signedInPage,
  signedInUser,
}) => {
  const event = await makeEvent({ name: "Browser Feedback Event" });
  await makeTicket({
    eventId: event.id,
    email: signedInUser.email,
    scanned: true,
  });

  const eligible = await signedInPage.request.get(
    `/api/feedback?eventId=${event.id}`,
  );
  expect(await eligible.json()).toMatchObject({
    eligible: true,
    via: "session",
    feedback: null,
  });
  const submit = await signedInPage.request.post("/api/feedback", {
    data: { eventId: event.id, score: 9, comment: "  Excellent event.  " },
  });
  expect(submit.status()).toBe(200);
  expect(await submit.json()).toMatchObject({
    success: true,
    feedback: { score: 9, comment: "Excellent event." },
  });
  const reloaded = await signedInPage.request.get(
    `/api/feedback?eventId=${event.id}`,
  );
  expect(await reloaded.json()).toMatchObject({
    eligible: true,
    feedback: { score: 9, comment: "Excellent event." },
  });
});

anonymousTest(
  "wallet routes enforce their unauthenticated contracts",
  async ({ request }) => {
    const ticketId = "00000000-0000-4000-8000-000000000099";
    const apple = await request.get(
      `/api/tickets/apple-wallet?ticket_id=${ticketId}`,
    );
    anonymousExpect(apple.status()).toBe(401);
    const google = await request.get(
      `/api/tickets/google-wallet?ticket_id=${ticketId}`,
      { maxRedirects: 0 },
    );
    anonymousExpect([302, 303, 307, 308]).toContain(google.status());
    anonymousExpect(google.headers().location).toContain("/api/auth/login");
  },
);

anonymousTest("remaining public static pages render", async ({ page }) => {
  for (const path of ["/event-sponsorship", "/join", "/suggest"]) {
    const response = await page.goto(path);
    anonymousExpect(response?.status(), path).toBeLessThan(400);
    await anonymousExpect(page.locator("main")).toBeVisible();
  }
});

test("signed-in subscribe records membership and returns home", async ({
  signedInPage,
  signedInUser,
}) => {
  const sql = getTestDatabase();
  cleanupEmailSideEffects(signedInUser.email);
  await signedInPage.goto("/subscribe");
  await expect(signedInPage).toHaveURL(/\/?subscribed=1$/);
  const [member] = await sql`
    select email, source from mailing_list where email = ${signedInUser.email}
  `;
  expect(member).toEqual({ email: signedInUser.email, source: "manual" });
});
