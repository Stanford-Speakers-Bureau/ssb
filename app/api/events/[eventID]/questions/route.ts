import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import {
  and,
  db,
  eq,
  eventQuestions,
  eventQuestionVotes,
  events,
  roles,
} from "@ssb/db";
import { QUESTION_MESSAGES } from "@/app/lib/constants";
import { checkRateLimit, questionRatelimit } from "@/app/lib/ratelimit";
import { recordMailingListMember } from "@/app/lib/mailing-list";
import { getQuestionsLifecycleState } from "@/app/events/[eventID]/questions/lifecycle";
import { isValidUUID } from "@/app/lib/validation";

const MIN_LEN = 4;
const MAX_LEN = 280;

function sanitize(input: string): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveEvent(routeOrId: string) {
  const isUuid = isValidUUID(routeOrId);
  return db.query.events.findFirst({
    where: isUuid ? eq(events.id, routeOrId) : eq(events.route, routeOrId),
    columns: {
      id: true,
      name: true,
      route: true,
      doorsOpen: true,
      startTimeDate: true,
      questionsEnabled: true,
      questionsRankingsHidden: true,
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventID: string }> },
) {
  try {
    const { eventID } = await params;
    const event = await resolveEvent(eventID);
    if (!event) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    const lifecycleState = getQuestionsLifecycleState({
      doorsOpen: event.doorsOpen,
      startTimeDate: event.startTimeDate,
      questionsEnabled: event.questionsEnabled,
    });

    const rankingsHidden = event.questionsRankingsHidden ?? false;
    const rows = await db.query.eventQuestions.findMany({
      where: and(
        eq(eventQuestions.eventId, event.id),
        eq(eventQuestions.approved, true),
        eq(eventQuestions.hidden, false),
        eq(eventQuestions.duplicate, false),
      ),
      columns: {
        id: true,
        question: true,
        votes: true,
        createdAt: true,
      },
      orderBy: (q, { desc, asc }) =>
        rankingsHidden ? [asc(q.createdAt)] : [desc(q.votes), asc(q.createdAt)],
    });

    if (rankingsHidden) {
      for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
    }

    const user = await getSessionUser();
    let userVotedIds: string[] = [];
    if (user?.email) {
      const voteRows = await db.query.eventQuestionVotes.findMany({
        where: eq(eventQuestionVotes.email, user.email),
        columns: { questionId: true },
      });
      userVotedIds = voteRows.map((v) => v.questionId);
    }

    return NextResponse.json({
      questions: rows.map((r, i) => ({
        id: r.id,
        question: r.question,
        rank: rankingsHidden ? null : i + 1,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
      })),
      userVotedIds,
      lifecycleState,
      rankingsHidden,
    });
  } catch (error) {
    console.error("GET event questions error:", error);
    return NextResponse.json(
      { error: QUESTION_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventID: string }> },
) {
  try {
    const { eventID } = await params;
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    const userRole = await db.query.roles.findFirst({
      where: eq(roles.email, user.email),
      columns: { roles: true },
    });
    if (userRole?.roles?.split(",").includes("banned")) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_BANNED },
        { status: 403 },
      );
    }

    const rateLimitResponse = await checkRateLimit(
      questionRatelimit,
      `event-question:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    const event = await resolveEvent(eventID);
    if (!event) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    const lifecycleState = getQuestionsLifecycleState({
      doorsOpen: event.doorsOpen,
      startTimeDate: event.startTimeDate,
      questionsEnabled: event.questionsEnabled,
    });
    if (lifecycleState === "closed") {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_LIFECYCLE_CLOSED },
        { status: 403 },
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { question } = body as { question?: string };
    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_MISSING },
        { status: 400 },
      );
    }

    const sanitized = sanitize(question);
    if (sanitized.length < MIN_LEN) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_TOO_SHORT },
        { status: 400 },
      );
    }
    if (sanitized.length > MAX_LEN) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_TOO_LONG },
        { status: 400 },
      );
    }

    const existing = await db.query.eventQuestions.findFirst({
      where: and(
        eq(eventQuestions.eventId, event.id),
        eq(eventQuestions.email, user.email),
        eq(eventQuestions.question, sanitized),
      ),
      columns: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: QUESTION_MESSAGES.ERROR_DUPLICATE },
        { status: 400 },
      );
    }

    const [inserted] = await db
      .insert(eventQuestions)
      .values({
        eventId: event.id,
        email: user.email,
        question: sanitized,
      })
      .returning({ id: eventQuestions.id });

    try {
      await db.insert(eventQuestionVotes).values({
        questionId: inserted.id,
        email: user.email,
      });
    } catch (voteError) {
      console.error("Initial question vote insert error:", voteError);
    }

    await recordMailingListMember({
      email: user.email,
      source: "event_question",
    });

    return NextResponse.json(
      { success: true, id: inserted.id },
      { status: 200 },
    );
  } catch (error) {
    console.error("POST event question error:", error);
    return NextResponse.json(
      { error: QUESTION_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}
