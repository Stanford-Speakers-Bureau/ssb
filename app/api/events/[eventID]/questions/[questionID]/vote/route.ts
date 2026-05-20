import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import {
  and,
  db,
  eq,
  eventQuestions,
  eventQuestionVotes,
  events,
} from "@ssb/db";
import { QUESTION_MESSAGES } from "@/app/lib/constants";
import { checkRateLimit, questionVoteRatelimit } from "@/app/lib/ratelimit";
import { isValidUUID } from "@/app/lib/validation";
import { recordMailingListMember } from "@/app/lib/mailing-list";
import { getQuestionsLifecycleState } from "@/app/events/[eventID]/questions/lifecycle";

async function resolveEvent(routeOrId: string) {
  const isUuid = isValidUUID(routeOrId);
  return db.query.events.findFirst({
    where: isUuid ? eq(events.id, routeOrId) : eq(events.route, routeOrId),
    columns: {
      id: true,
      doorsOpen: true,
      startTimeDate: true,
      questionsEnabled: true,
    },
  });
}

async function guardAuthAndLifecycle(eventID: string) {
  const user = await getSessionUser();
  if (!user?.email) {
    return {
      error: NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      ),
      user: null,
      event: null,
    } as const;
  }

  const event = await resolveEvent(eventID);
  if (!event) {
    return {
      error: NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      ),
      user,
      event: null,
    } as const;
  }

  const lifecycleState = getQuestionsLifecycleState({
    doorsOpen: event.doorsOpen,
    startTimeDate: event.startTimeDate,
    questionsEnabled: event.questionsEnabled,
  });
  if (lifecycleState !== "open") {
    return {
      error: NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_LIFECYCLE_CLOSED },
        { status: 403 },
      ),
      user,
      event,
    } as const;
  }

  return { error: null, user, event } as const;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventID: string; questionID: string }> },
) {
  try {
    const { eventID, questionID } = await params;

    if (!isValidUUID(questionID)) {
      return NextResponse.json(
        { error: "Invalid question ID format" },
        { status: 400 },
      );
    }

    const guard = await guardAuthAndLifecycle(eventID);
    if (guard.error) return guard.error;
    const { user, event } = guard;

    const rateLimitResponse = await checkRateLimit(
      questionVoteRatelimit,
      `event-question-vote:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    const question = await db.query.eventQuestions.findFirst({
      where: and(
        eq(eventQuestions.id, questionID),
        eq(eventQuestions.eventId, event.id),
        eq(eventQuestions.approved, true),
        eq(eventQuestions.hidden, false),
        eq(eventQuestions.duplicate, false),
      ),
      columns: { id: true },
    });
    if (!question) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_QUESTION_NOT_FOUND },
        { status: 404 },
      );
    }

    const existingVote = await db.query.eventQuestionVotes.findFirst({
      where: and(
        eq(eventQuestionVotes.questionId, questionID),
        eq(eventQuestionVotes.email, user.email),
      ),
      columns: { id: true },
    });
    if (existingVote) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ALREADY_VOTED, alreadyVoted: true },
        { status: 400 },
      );
    }

    await db.insert(eventQuestionVotes).values({
      questionId: questionID,
      email: user.email,
    });
    await recordMailingListMember({
      email: user.email,
      source: "event_question_vote",
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("POST event question vote error:", error);
    return NextResponse.json(
      { error: QUESTION_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ eventID: string; questionID: string }> },
) {
  try {
    const { eventID, questionID } = await params;

    if (!isValidUUID(questionID)) {
      return NextResponse.json(
        { error: "Invalid question ID format" },
        { status: 400 },
      );
    }

    const guard = await guardAuthAndLifecycle(eventID);
    if (guard.error) return guard.error;
    const { user, event } = guard;

    const rateLimitResponse = await checkRateLimit(
      questionVoteRatelimit,
      `event-question-vote:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    const question = await db.query.eventQuestions.findFirst({
      where: and(
        eq(eventQuestions.id, questionID),
        eq(eventQuestions.eventId, event.id),
      ),
      columns: { id: true },
    });
    if (!question) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_QUESTION_NOT_FOUND },
        { status: 404 },
      );
    }

    const existingVote = await db.query.eventQuestionVotes.findFirst({
      where: and(
        eq(eventQuestionVotes.questionId, questionID),
        eq(eventQuestionVotes.email, user.email),
      ),
      columns: { id: true },
    });
    if (!existingVote) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.NOT_VOTED },
        { status: 400 },
      );
    }

    await db
      .delete(eventQuestionVotes)
      .where(eq(eventQuestionVotes.id, existingVote.id));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE event question vote error:", error);
    return NextResponse.json(
      { error: QUESTION_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}
