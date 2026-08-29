import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  cleanup,
  closeTestDatabase,
  getTestDatabase,
  makeEvent,
  testEmail,
} from "../helpers/factories";
import {
  REFERRAL_VALIDATION_MESSAGES,
  validateReferralInput,
} from "@/app/lib/referrals";
import { generateReferralCode } from "@/app/lib/utils";

const integration =
  process.env.TEST_INTEGRATION === "1" ? describe : describe.skip;

integration("referral and vote database contracts", () => {
  afterEach(cleanup);
  afterAll(closeTestDatabase);

  test("accepts a registered referral and increments its count", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent({ referralsEnabled: true });
    const referral = "valid-referrer";
    await sql`
      insert into referrals (event_id, referral_code, count)
      values (${event.id}, ${referral}, 0)
    `;

    await sql`select public.create_ticket_with_name(
      ${event.id}::uuid, ${referral}, ${"Referred User"}, ${testEmail("referred")}
    )`;
    const [row] = await sql`
      select count from referrals
      where event_id = ${event.id} and referral_code = ${referral}
    `;
    expect(Number(row.count)).toBe(1);
  });

  test("rejects invalid and self-referral codes against real storage", async () => {
    const event = await makeEvent({ referralsEnabled: true });
    const email = testEmail("self-referrer");

    await expect(
      validateReferralInput({
        eventId: event.id,
        referralCode: "missing-code",
        userEmail: email,
        referralsEnabled: true,
      }),
    ).resolves.toMatchObject({
      ok: false,
      message: REFERRAL_VALIDATION_MESSAGES.INVALID,
      reason: "invalid",
    });

    await expect(
      validateReferralInput({
        eventId: event.id,
        referralCode: generateReferralCode(email),
        userEmail: email,
        referralsEnabled: true,
      }),
    ).resolves.toMatchObject({
      ok: false,
      message: REFERRAL_VALIDATION_MESSAGES.SELF_REFERRAL,
      reason: "self_referral",
    });
  });

  test("question vote triggers remain in sync on insert and delete", async () => {
    const sql = getTestDatabase();
    const event = await makeEvent();
    const questionId = randomUUID();
    const voteId = randomUUID();
    await sql`
      insert into event_questions (id, event_id, email, question, approved)
      values (${questionId}, ${event.id}, ${testEmail("asker")},
        ${"What should students learn from this talk?"}, true)
    `;
    await sql`
      insert into event_question_votes (id, question_id, email)
      values (${voteId}, ${questionId}, ${testEmail("voter")})
    `;
    const [afterInsert] = await sql`
      select votes from event_questions where id = ${questionId}
    `;
    await sql`delete from event_question_votes where id = ${voteId}`;
    const [afterDelete] = await sql`
      select votes from event_questions where id = ${questionId}
    `;

    expect(Number(afterInsert.votes)).toBe(1);
    expect(Number(afterDelete.votes)).toBe(0);
  });
});
