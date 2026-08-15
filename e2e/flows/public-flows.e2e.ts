import { randomUUID } from "node:crypto";

import { test, expect } from "../fixtures";
import {
  getTestDatabase,
  makeEvent,
  makeSuggestion,
  makeTicket,
  registerCleanup,
  testEmail,
} from "../helpers/db";

function registerUserSideEffectCleanup(email: string): void {
  const sql = getTestDatabase();
  registerCleanup(async () => {
    await sql`delete from event_question_votes where email = ${email}`;
    await sql`delete from votes where email = ${email}`;
    await sql`delete from suggest where email = ${email}`;
    await sql`delete from notify where email = ${email}`;
    await sql`delete from mailing_list where email = ${email}`;
    await sql`
      delete from audit_logs where actor = ${email} or target_email = ${email}
    `;
  });
}

test("ticket lifecycle reaches the real API, database, and account UI", async ({
  signedInPage,
  signedInUser,
}) => {
  const sql = getTestDatabase();
  const event = await makeEvent({
    name: "Browser Ticket Lifecycle",
    capacity: 2,
  });
  registerUserSideEffectCleanup(signedInUser.email);

  const purchase = await signedInPage.request.post("/api/tickets", {
    data: { event_id: event.id },
  });
  expect(purchase.status()).toBe(200);
  expect(await purchase.json()).toMatchObject({
    success: true,
    ticketType: "STANDARD",
  });

  const [stored] = await sql`
    select id, email, type from tickets
    where event_id = ${event.id} and email = ${signedInUser.email}
  `;
  expect(stored).toMatchObject({
    email: signedInUser.email,
    type: "STANDARD",
  });

  const duplicate = await signedInPage.request.post("/api/tickets", {
    data: { event_id: event.id },
  });
  expect(duplicate.status()).toBe(400);
  expect(await duplicate.json()).toMatchObject({
    error: expect.stringMatching(/already have a ticket/i),
  });

  await signedInPage.goto("/account");
  await expect(
    signedInPage.getByText("Browser Ticket Lifecycle"),
  ).toBeVisible();

  const cancellation = await signedInPage.request.delete("/api/tickets", {
    data: { event_id: event.id },
  });
  expect(cancellation.status()).toBe(200);
  const [liveCount, archived] = await Promise.all([
    sql`
      select count(*)::int as count from tickets
      where event_id = ${event.id} and email = ${signedInUser.email}
    `,
    sql`
      select original_ticket_id from canceled_tickets
      where event_id = ${event.id} and email = ${signedInUser.email}
    `,
  ]);
  expect(liveCount[0].count).toBe(0);
  expect(archived[0].original_ticket_id).toBe(stored.id);

  const repurchase = await signedInPage.request.post("/api/tickets", {
    data: { event_id: event.id },
  });
  expect(repurchase.status()).toBe(200);
});

test("sold-out waitlist join, duplicate, status, and leave round-trip", async ({
  signedInPage,
  signedInUser,
}) => {
  const event = await makeEvent({ name: "Browser Waitlist", capacity: 1 });
  await makeTicket({ eventId: event.id, email: testEmail("sold-out-owner") });
  registerUserSideEffectCleanup(signedInUser.email);

  const joined = await signedInPage.request.post("/api/waitlist", {
    data: { event_id: event.id },
  });
  expect(joined.status()).toBe(200);
  expect(await joined.json()).toMatchObject({ success: true, position: 1 });

  const duplicate = await signedInPage.request.post("/api/waitlist", {
    data: { event_id: event.id },
  });
  expect(duplicate.status()).toBe(400);
  expect(await duplicate.json()).toMatchObject({
    error: expect.stringMatching(/already on the waitlist/i),
  });

  const status = await signedInPage.request.get(
    `/api/waitlist?eventId=${event.id}`,
  );
  expect(await status.json()).toMatchObject({
    isOnWaitlist: true,
    position: 1,
    total: 1,
  });

  const left = await signedInPage.request.delete("/api/waitlist", {
    data: { event_id: event.id },
  });
  expect(left.status()).toBe(200);
  const afterLeave = await signedInPage.request.get(
    `/api/waitlist?eventId=${event.id}`,
  );
  expect(await afterLeave.json()).toMatchObject({
    isOnWaitlist: false,
    position: null,
    total: 0,
  });
});

test("question submission and vote toggling update trigger-maintained counts", async ({
  signedInPage,
  signedInUser,
}) => {
  const sql = getTestDatabase();
  const event = await makeEvent({ name: "Browser Questions" });
  registerUserSideEffectCleanup(signedInUser.email);

  const submission = await signedInPage.request.post(
    `/api/events/${event.route}/questions`,
    { data: { question: "  What   inspired this work?  " } },
  );
  expect(submission.status()).toBe(200);
  const [submitted] = await sql`
    select question, votes::int from event_questions
    where event_id = ${event.id} and email = ${signedInUser.email}
  `;
  expect(submitted).toEqual({
    question: "What inspired this work?",
    votes: 1,
  });

  const questionId = randomUUID();
  await sql`
    insert into event_questions (
      id, event_id, email, question, approved, reviewed
    ) values (
      ${questionId}, ${event.id}, ${testEmail("question-author")},
      ${"How should students get started?"}, true, true
    )
  `;

  const vote = await signedInPage.request.post(
    `/api/events/${event.route}/questions/${questionId}/vote`,
    { data: {} },
  );
  const voteBody = await vote.json();
  expect(vote.status(), JSON.stringify(voteBody)).toBe(200);
  const [afterVote] = await sql`
    select votes::int from event_questions where id = ${questionId}
  `;
  expect(afterVote.votes).toBe(1);

  const unvote = await signedInPage.request.delete(
    `/api/events/${event.route}/questions/${questionId}/vote`,
    { data: {} },
  );
  expect(unvote.status()).toBe(200);
  const [afterUnvote] = await sql`
    select votes::int from event_questions where id = ${questionId}
  `;
  expect(afterUnvote.votes).toBe(0);
});

test("suggest, leaderboard vote, and notify-me flows are idempotent", async ({
  signedInPage,
  signedInUser,
}) => {
  const sql = getTestDatabase();
  const event = await makeEvent({ name: "Browser Notify" });
  const approved = await makeSuggestion(testEmail("approved-suggester"));
  registerUserSideEffectCleanup(signedInUser.email);

  const suggestion = await signedInPage.request.post("/api/suggest", {
    data: { speaker: "  jane   DOE  " },
  });
  expect(suggestion.status()).toBe(200);
  const [storedSuggestion] = await sql`
    select speaker, votes::int from suggest
    where email = ${signedInUser.email}
  `;
  expect(storedSuggestion).toEqual({ speaker: "Jane Doe", votes: 1 });

  const vote = await signedInPage.request.post("/api/vote", {
    data: { speaker_id: approved.id },
  });
  expect(vote.status()).toBe(200);
  const unvote = await signedInPage.request.delete("/api/vote", {
    data: { speaker_id: approved.id },
  });
  expect(unvote.status()).toBe(200);

  const notify = await signedInPage.request.post("/api/notify", {
    data: { speaker_id: event.id },
  });
  const duplicateNotify = await signedInPage.request.post("/api/notify", {
    data: { speaker_id: event.id },
  });
  expect(await notify.json()).toEqual({
    success: true,
    alreadySignedUp: false,
  });
  expect(await duplicateNotify.json()).toEqual({
    success: true,
    alreadySignedUp: true,
  });
});
