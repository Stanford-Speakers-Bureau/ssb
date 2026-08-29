import { randomUUID } from "node:crypto";

import { test, expect } from "../fixtures";
import {
  getTestDatabase,
  makeEvent,
  makeTicket,
  registerCleanup,
  testEmail,
  uniqueTestValue,
} from "../helpers/db";

function cleanupAdminEffects(actor: string, target?: string): void {
  const sql = getTestDatabase();
  registerCleanup(async () => {
    await sql`
      delete from audit_logs
      where actor = ${actor}
        or target_email = ${actor}
        or target_email = ${target ?? actor}
    `;
  });
}

test("question moderation approves, edits, hides, and unhides a real row", async ({
  superadminPage,
  superadminUser,
}) => {
  const sql = getTestDatabase();
  const event = await makeEvent({ name: "Admin Q&A Contract" });
  const questionId = randomUUID();
  const author = testEmail("question-author");
  cleanupAdminEffects(superadminUser.email, author);
  await sql`
    insert into event_questions (id, event_id, email, question)
    values (${questionId}, ${event.id}, ${author}, 'Original admin question?')
  `;

  const approve = await superadminPage.request.post("/api/event-questions", {
    data: { id: questionId, action: "approve" },
  });
  expect(approve.status()).toBe(200);
  const edit = await superadminPage.request.patch("/api/event-questions", {
    data: { id: questionId, question: "Edited admin question?" },
  });
  expect(edit.status()).toBe(200);
  for (const hidden of [true, false]) {
    const response = await superadminPage.request.patch(
      "/api/event-questions",
      { data: { id: questionId, hidden } },
    );
    expect(response.status()).toBe(200);
  }

  const [stored] = await sql`
    select question, approved, reviewed, hidden
    from event_questions where id = ${questionId}
  `;
  expect(stored).toEqual({
    question: "Edited admin question?",
    approved: true,
    reviewed: true,
    hidden: false,
  });
});

test("suggestion moderation approves, renames, and records a speaker as having appeared", async ({
  superadminPage,
  superadminUser,
}) => {
  const sql = getTestDatabase();
  const id = randomUUID();
  const author = testEmail("suggestion-author");
  cleanupAdminEffects(superadminUser.email, author);
  registerCleanup(() => sql`delete from suggest where id = ${id}`);
  await sql`
    insert into suggest (id, email, speaker, approved, reviewed)
    values (${id}, ${author}, 'Original Speaker', false, false)
  `;

  const approve = await superadminPage.request.post("/api/suggestions", {
    data: { id, action: "approve" },
  });
  expect(approve.status()).toBe(200);
  const rename = await superadminPage.request.patch("/api/suggestions", {
    data: { id, speaker: "Renamed Speaker" },
  });
  expect(rename.status()).toBe(200);
  const spoke = await superadminPage.request.patch("/api/suggestions", {
    data: { id, spoke: true, eventLink: "https://example.test/past-event" },
  });
  expect(spoke.status()).toBe(200);

  const [stored] = await sql`
    select speaker, approved, reviewed, spoke, event_link
    from suggest where id = ${id}
  `;
  expect(stored).toEqual({
    speaker: "Renamed Speaker",
    approved: true,
    reviewed: true,
    spoke: true,
    event_link: "https://example.test/past-event",
  });
});

test("campaign draft, edit, audience preview, test-send, and final send complete", async ({
  superadminPage,
  superadminUser,
}) => {
  const sql = getTestDatabase();
  const event = await makeEvent({ name: "Admin Campaign Lifecycle" });
  const attendee = testEmail("campaign-recipient");
  await makeTicket({ eventId: event.id, email: attendee });
  cleanupAdminEffects(superadminUser.email, attendee);
  const audiences = [{ type: "event_ticketholders", eventIds: [event.id] }];

  const create = await superadminPage.request.post("/api/campaigns", {
    data: {
      subject: "Lifecycle draft",
      body: "Initial body",
      audiences,
      eventId: event.id,
      footerType: "essential",
    },
  });
  expect(create.status()).toBe(201);
  const created = await create.json();
  const campaignId = created.campaign.id as string;
  registerCleanup(
    () => sql`delete from email_campaigns where id = ${campaignId}`,
  );

  const edit = await superadminPage.request.patch(
    `/api/campaigns/${campaignId}`,
    {
      data: {
        subject: "Lifecycle edited",
        body: "Edited **campaign** body",
      },
    },
  );
  expect(edit.status()).toBe(200);
  const preview = await superadminPage.request.get(
    `/api/campaigns/${campaignId}?includeAudience=true`,
  );
  expect(await preview.json()).toMatchObject({
    audienceCount: 1,
    audienceEmails: [attendee],
  });
  const testSend = await superadminPage.request.post(
    `/api/campaigns/${campaignId}/test`,
    { data: {} },
  );
  expect(testSend.status()).toBe(200);

  const send = await superadminPage.request.post(
    `/api/campaigns/${campaignId}/send`,
    {
      data: {
        emails: [attendee],
        auditBatchId: `e2e-${campaignId}`,
        chunkIndex: 0,
        chunkCount: 1,
      },
    },
  );
  expect(send.status(), JSON.stringify(await send.json())).toBe(200);
  const [stored] = await sql`
    select status, recipient_count::int, failed_count::int
    from email_campaigns where id = ${campaignId}
  `;
  expect(stored).toEqual({
    status: "sent",
    recipient_count: 1,
    failed_count: 0,
  });
});

test("event creation and editing persist validated multipart fields", async ({
  superadminPage,
  superadminUser,
}) => {
  const sql = getTestDatabase();
  const route = uniqueTestValue("admin-created-event");
  cleanupAdminEffects(superadminUser.email);
  const baseForm = {
    name: "Created Through Admin API",
    desc: "Created by the browser suite",
    tagline: "A tested event",
    capacity: "50",
    tickets: "5",
    reserved: "5",
    venue: "Test Auditorium",
    venue_link: "https://example.test/venue",
    release_date: "2030-01-01T09:00",
    ticketing_date: "2030-01-02T09:00",
    start_time_date: "2030-02-01T19:00",
    end_time_date: "2030-02-01T21:00",
    doors_open: "2030-02-01T18:30",
    route,
    latitude: "37.4275",
    longitude: "-122.1697",
    address: "450 Jane Stanford Way",
  };
  const create = await superadminPage.request.post("/api/events", {
    multipart: baseForm,
  });
  const created = await create.json().catch(() => null);
  expect(create.status(), JSON.stringify(created)).toBe(200);
  const eventId = created?.event?.id as string | undefined;
  expect(eventId).toBeTruthy();
  registerCleanup(() => sql`delete from events where id = ${eventId!}`);

  const edit = await superadminPage.request.post("/api/events", {
    multipart: {
      ...baseForm,
      id: eventId!,
      name: "Edited Through Admin API",
      capacity: "60",
    },
  });
  expect(edit.status()).toBe(200);
  const [stored] = await sql`
    select name, capacity::int, route from events where id = ${eventId!}
  `;
  expect(stored).toEqual({
    name: "Edited Through Admin API",
    capacity: 60,
    route,
  });
});

test("user role add, duplicate reporting, and removal round-trip", async ({
  superadminPage,
  superadminUser,
}) => {
  const sql = getTestDatabase();
  const target = testEmail("scanner-role-target");
  cleanupAdminEffects(superadminUser.email, target);
  registerCleanup(() => sql`delete from roles where email = ${target}`);

  const add = await superadminPage.request.post("/api/users", {
    data: { email: target.toUpperCase(), type: "scanner", action: "add" },
  });
  expect(add.status()).toBe(200);
  const added = await add.json();
  expect(added.user).toMatchObject({ email: target, roles: "scanner" });
  const duplicate = await superadminPage.request.post("/api/users", {
    data: { email: target, type: "scanner", action: "add" },
  });
  expect(await duplicate.json()).toMatchObject({
    success: false,
    errors: [expect.objectContaining({ email: target })],
  });
  const remove = await superadminPage.request.post("/api/users", {
    data: { id: added.user.id, type: "scanner", action: "remove" },
  });
  expect(remove.status()).toBe(200);
  const [stored] =
    await sql`select roles from roles where id = ${added.user.id}`;
  expect(stored.roles).toBe("");
});

test("all planned admin analytics and operations pages render", async ({
  superadminPage,
}) => {
  await makeEvent({ name: "Admin Analytics Navigation" });
  for (const path of [
    "/summary",
    "/sales",
    "/audience",
    "/feedback-analytics",
    "/notify-analytics",
    "/attendance",
    "/referrals",
    "/audit",
    "/mailing-lists",
    "/suggest",
    "/event-questions",
    "/waitlist",
    "/campaigns",
    "/events",
    "/users",
  ]) {
    const response = await superadminPage.goto(path);
    expect(response?.status(), path).toBeLessThan(400);
    await expect(superadminPage.locator("main")).toBeVisible();
  }
});
