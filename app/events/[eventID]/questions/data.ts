import {
  and,
  db,
  eq,
  eventQuestions,
  eventQuestionVotes,
} from "@ssb/db";

export type EventQuestion = {
  id: string;
  question: string;
  votes: number;
  rank: number;
  hasVoted: boolean;
  createdAt: string;
};

export type UserEventQuestion = {
  id: string;
  question: string;
  approved: boolean;
  reviewed: boolean;
  hidden: boolean;
  duplicate: boolean;
  votes: number;
  createdAt: string;
};

export async function getEventQuestions(
  eventId: string,
  userEmail: string | null,
): Promise<EventQuestion[]> {
  const rows = await db.query.eventQuestions.findMany({
    where: and(
      eq(eventQuestions.eventId, eventId),
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
    orderBy: (q, { desc, asc }) => [desc(q.votes), asc(q.createdAt)],
  });

  let userVotes = new Set<string>();
  if (userEmail) {
    const voteRows = await db.query.eventQuestionVotes.findMany({
      where: eq(eventQuestionVotes.email, userEmail),
      columns: { questionId: true },
    });
    userVotes = new Set(voteRows.map((v) => v.questionId));
  }

  return rows.map((r, i) => ({
    id: r.id,
    question: r.question,
    votes: r.votes ?? 0,
    rank: i + 1,
    hasVoted: userVotes.has(r.id),
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}

export async function getUserEventQuestions(
  eventId: string,
  userEmail: string | null,
): Promise<UserEventQuestion[]> {
  if (!userEmail) return [];

  const rows = await db.query.eventQuestions.findMany({
    where: and(
      eq(eventQuestions.eventId, eventId),
      eq(eventQuestions.email, userEmail),
    ),
    columns: {
      id: true,
      question: true,
      approved: true,
      reviewed: true,
      hidden: true,
      duplicate: true,
      votes: true,
      createdAt: true,
    },
    orderBy: (q, { desc }) => [desc(q.createdAt)],
  });

  return rows.map((r) => ({
    id: r.id,
    question: r.question,
    approved: !!r.approved,
    reviewed: !!r.reviewed,
    hidden: !!r.hidden,
    duplicate: !!r.duplicate,
    votes: r.votes ?? 0,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}
