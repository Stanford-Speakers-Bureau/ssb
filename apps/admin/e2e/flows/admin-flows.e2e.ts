import { test, expect } from "../fixtures";
import {
  getTestDatabase,
  makeEvent,
  makeWaitlistEntry,
  registerCleanup,
  testEmail,
} from "../helpers/db";

function registerAdminSideEffectCleanup(actor: string, target?: string): void {
  const sql = getTestDatabase();
  registerCleanup(async () => {
    if (target) {
      await sql`delete from mailing_list where email = ${target}`;
    }
    await sql`
      delete from audit_logs
      where actor = ${actor}
        or target_email = ${actor}
        or target_email = ${target ?? actor}
    `;
  });
}

test("ticket create, edit, check-in, UI refresh, and cancellation promote", async ({
  superadminPage,
  superadminUser,
}) => {
  const sql = getTestDatabase();
  const event = await makeEvent({
    name: "Admin Browser Ticket Flow",
    capacity: 2,
    reserved: 1,
  });
  const attendee = testEmail("admin-created-attendee");
  const waiting = testEmail("admin-promoted-attendee");
  registerAdminSideEffectCleanup(superadminUser.email, attendee);

  const creation = await superadminPage.request.post("/api/tickets", {
    data: {
      email: attendee,
      eventId: event.id,
      type: "STANDARD",
      name: "Original Admin Name",
    },
  });
  expect(creation.status()).toBe(200);
  const createdBody = await creation.json();
  const ticketId = createdBody.ticket.id as string;

  for (const data of [
    { id: ticketId, action: "updateName", name: "Renamed By Admin" },
    { id: ticketId, action: "updateTitle", title: "Distinguished Guest" },
    { id: ticketId, action: "updateType", type: "VIP" },
    { id: ticketId, action: "updateScanned", scanned: true },
  ]) {
    const response = await superadminPage.request.patch("/api/tickets", {
      data,
    });
    expect(response.status(), JSON.stringify(await response.json())).toBe(200);
  }

  const [updated] = await sql`
    select name, title, type, scanned from tickets where id = ${ticketId}
  `;
  const [eventCounts] = await sql`
    select scanned::int, public_tickets_sold::int, vip_tickets_sold::int
    from events where id = ${event.id}
  `;
  expect(updated).toEqual({
    name: "Renamed By Admin",
    title: "Distinguished Guest",
    type: "VIP",
    scanned: true,
  });
  expect(eventCounts).toEqual({
    scanned: 1,
    public_tickets_sold: 0,
    vip_tickets_sold: 1,
  });

  await superadminPage.goto(`/tickets/${event.id}`);
  await expect(
    superadminPage.getByText("Renamed By Admin").first(),
  ).toBeVisible();

  const unscan = await superadminPage.request.patch("/api/tickets", {
    data: { id: ticketId, action: "unscan" },
  });
  expect(unscan.status()).toBe(200);
  await makeWaitlistEntry({
    eventId: event.id,
    email: waiting,
    name: "Promoted Browser User",
  });
  const cancellation = await superadminPage.request.delete("/api/tickets", {
    data: { id: ticketId, sendCancellationEmail: false },
  });
  expect(cancellation.status(), JSON.stringify(await cancellation.json())).toBe(
    200,
  );

  const [promoted] = await sql`
    select email, name, type from tickets where event_id = ${event.id}
  `;
  expect(promoted).toEqual({
    email: waiting,
    name: "Promoted Browser User",
    type: "STANDARD",
  });
});

test("event toggles and campaign draft/list use authenticated admin APIs", async ({
  superadminPage,
  superadminUser,
}) => {
  const sql = getTestDatabase();
  const event = await makeEvent({ name: "Admin Browser Campaign Event" });
  registerAdminSideEffectCleanup(superadminUser.email);

  const toggle = await superadminPage.request.patch("/api/events", {
    data: { id: event.id, live: false },
  });
  expect(toggle.status()).toBe(200);
  const [toggled] = await sql`
    select live from events where id = ${event.id}
  `;
  expect(toggled.live).toBe(false);

  const subject = `Browser campaign ${event.route}`;
  const creation = await superadminPage.request.post("/api/campaigns", {
    data: {
      subject,
      body: "<p>Browser campaign body</p>",
      audiences: [{ type: "event_ticketholders", eventIds: [event.id] }],
      eventId: event.id,
      footerType: "essential",
    },
  });
  expect(creation.status()).toBe(201);
  const created = await creation.json();
  registerCleanup(
    () => sql`delete from email_campaigns where id = ${created.campaign.id}`,
  );

  const list = await superadminPage.request.get("/api/campaigns");
  expect(list.status()).toBe(200);
  expect((await list.json()).campaigns).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: created.campaign.id,
        subject,
        status: "draft",
      }),
    ]),
  );
});

test("superadmin permission grant is canonical, duplicate-safe, and revocable", async ({
  superadminPage,
  superadminUser,
}) => {
  const sql = getTestDatabase();
  const event = await makeEvent({ name: "Admin Browser Permission Event" });
  const target = testEmail("permission-target");
  registerAdminSideEffectCleanup(superadminUser.email, target);

  const grant = await superadminPage.request.post("/api/permissions", {
    data: {
      action: "grant",
      email: `  ${target.toUpperCase()}  `,
      permission: "tickets.edit",
      eventId: event.id,
    },
  });
  expect(grant.status()).toBe(200);
  const granted = await grant.json();
  expect(granted.grant).toMatchObject({
    email: target,
    action: "tickets.edit",
    eventId: event.id,
  });

  const duplicate = await superadminPage.request.post("/api/permissions", {
    data: {
      action: "grant",
      email: target,
      permission: "tickets.edit",
      eventId: event.id,
    },
  });
  expect(duplicate.status()).toBe(409);

  const revoke = await superadminPage.request.post("/api/permissions", {
    data: { action: "revoke", id: granted.grant.id },
  });
  expect(revoke.status()).toBe(200);
  const [remaining] = await sql`
    select count(*)::int as count from permission_grants
    where id = ${granted.grant.id}
  `;
  expect(remaining.count).toBe(0);
});

test("event-scoped admin can read only the granted event", async ({
  scopedAdminPage,
  scopedAdminEvent,
}) => {
  const blockedEvent = await makeEvent({ name: "Blocked Scoped Event" });

  const allowed = await scopedAdminPage.request.get(
    `/api/tickets?eventId=${scopedAdminEvent.id}`,
  );
  const blocked = await scopedAdminPage.request.get(
    `/api/tickets?eventId=${blockedEvent.id}`,
  );

  expect(allowed.status()).toBe(200);
  expect(blocked.status()).toBe(401);
  expect(await blocked.json()).toMatchObject({ error: "Not authorized" });
});
