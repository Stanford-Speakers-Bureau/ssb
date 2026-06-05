import { and, db, eq, eventQuestions, eventQuestionVotes } from "@ssb/db";

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
  rankingsHidden = false,
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
    // When rankings are hidden from the public we deliberately don't order by
    // votes — they're shuffled below so no ranking signal leaks. Otherwise the
    // top-voted questions lead, with oldest-first as the tiebreaker.
    orderBy: (q, { desc, asc }) =>
      rankingsHidden ? [asc(q.createdAt)] : [desc(q.votes), asc(q.createdAt)],
  });

  // Fisher–Yates shuffle, re-rolled on every request so the public never sees a
  // stable order they could mistake for a ranking.
  if (rankingsHidden) {
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
  }

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
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : String(r.createdAt),
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
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : String(r.createdAt),
  }));
}
