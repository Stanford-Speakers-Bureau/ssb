import { test, expect } from "@playwright/test";

import {
  cleanup,
  getTestDatabase,
  grantRole,
  makeEvent,
  makeUserProfile,
  registerCleanup,
  testEmail,
} from "../helpers/db";
import { forgeSessionCookie, makeE2EUser } from "../helpers/session";

test.afterEach(cleanup);

test("one forged localhost session authenticates both apps", async ({
  page,
}) => {
  test.skip(
    process.env.CROSS_APP !== "1",
    "requires both sibling repositories",
  );
  const email = testEmail("cross-app-admin");
  await makeUserProfile(email);
  await grantRole(email, "admin");
  await page
    .context()
    .addCookies([await forgeSessionCookie(makeE2EUser(email))]);

  await page.goto("http://localhost:3100/account");
  await expect(page.getByText(email)).toBeVisible();
  await page.goto("http://localhost:3101/");
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
});

test("ticket edits and check-in state stay synchronized across apps", async ({
  page,
}) => {
  test.skip(
    process.env.CROSS_APP !== "1",
    "requires both sibling repositories",
  );
  const sql = getTestDatabase();
  const email = testEmail("cross-app-holder");
  const event = await makeEvent({
    name: "Cross App Lifecycle Event",
    capacity: 2,
    reserved: 1,
  });
  await makeUserProfile(email);
  await grantRole(email, "admin");
  registerCleanup(async () => {
    await sql`delete from mailing_list where email = ${email}`;
    await sql`
      delete from audit_logs where actor = ${email} or target_email = ${email}
    `;
  });
  await page
    .context()
    .addCookies([await forgeSessionCookie(makeE2EUser(email))]);

  const purchase = await page.request.post(
    "http://localhost:3100/api/tickets",
    { data: { event_id: event.id } },
  );
  expect(purchase.status()).toBe(200);

  const adminList = await page.request.get(
    `http://localhost:3101/api/tickets?eventId=${event.id}&search=${encodeURIComponent(email)}`,
  );
  expect(adminList.status()).toBe(200);
  const adminBody = await adminList.json();
  expect(adminBody.tickets).toHaveLength(1);
  const ticketId = adminBody.tickets[0].id as string;

  for (const data of [
    { id: ticketId, action: "updateName", name: "Cross App Renamed" },
    { id: ticketId, action: "updateType", type: "VIP" },
    { id: ticketId, action: "updateScanned", scanned: true },
  ]) {
    const response = await page.request.patch(
      "http://localhost:3101/api/tickets",
      { data },
    );
    expect(response.status(), JSON.stringify(await response.json())).toBe(200);
  }

  const webState = await page.request.get(
    `http://localhost:3100/api/tickets?eventId=${event.id}`,
  );
  expect(await webState.json()).toMatchObject({
    hasTicket: true,
    ticketId,
    ticketType: "VIP",
    ticketName: "Cross App Renamed",
    isScanned: true,
  });

  const unscan = await page.request.patch("http://localhost:3101/api/tickets", {
    data: { id: ticketId, action: "unscan" },
  });
  expect(unscan.status()).toBe(200);
  const afterUnscan = await page.request.get(
    `http://localhost:3100/api/tickets?eventId=${event.id}`,
  );
  expect(await afterUnscan.json()).toMatchObject({ isScanned: false });

  const cancellation = await page.request.delete(
    "http://localhost:3101/api/tickets",
    { data: { id: ticketId, sendCancellationEmail: false } },
  );
  expect(cancellation.status()).toBe(200);
  const afterCancel = await page.request.get(
    `http://localhost:3100/api/tickets?eventId=${event.id}`,
  );
  expect(await afterCancel.json()).toMatchObject({
    hasTicket: false,
    ticketId: null,
  });
});
