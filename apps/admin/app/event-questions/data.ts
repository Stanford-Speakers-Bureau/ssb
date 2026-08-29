import { getSessionUser } from "@/app/lib/auth";
import { getEffectivePermissions } from "@/app/lib/permissions";
import {
  db,
  eventQuestionVotes,
  events,
  eventQuestions,
  inArray,
} from "@ssb/db";

export type AdminEventQuestion = {
  id: string;
  created_at: string;
  event_id: string;
  event_name: string;
  event_route: string | null;
  email: string;
  question: string;
  approved: boolean;
  reviewed: boolean;
  duplicate: boolean;
  hidden: boolean;
  votes: number;
  voters: string[];
};

export async function getAdminEventQuestions(): Promise<{
  questions: AdminEventQuestion[];
}> {
  try {
    const user = await getSessionUser();
    const perms = await getEffectivePermissions(user?.email);
    const canAllEvents =
      perms.isAdmin || perms.allEventActions.has("questions.manage");
    const scopedEventIds = perms.eventScopes.get("questions.manage");

    // No questions.manage anywhere → nothing to show.
    if (!canAllEvents && (!scopedEventIds || scopedEventIds.size === 0)) {
      return { questions: [] };
    }

    const rows = await db.query.eventQuestions.findMany({
      where: canAllEvents
        ? undefined
        : inArray(eventQuestions.eventId, [...scopedEventIds!]),
      orderBy: (q, { desc }) => [desc(q.createdAt)],
    });

    const eventIds = Array.from(new Set(rows.map((r) => r.eventId)));
    const eventRows =
      eventIds.length > 0
        ? await db.query.events.findMany({
            where: inArray(events.id, eventIds),
            columns: { id: true, name: true, route: true },
          })
        : [];
    const eventMap = new Map(eventRows.map((e) => [e.id, e]));

    const questionIds = rows.map((r) => r.id);
    const voters: Record<string, string[]> = {};
    if (questionIds.length > 0) {
      const allVotes = await db.query.eventQuestionVotes.findMany({
        where: inArray(eventQuestionVotes.questionId, questionIds),
        columns: { questionId: true, email: true },
      });
      for (const v of allVotes) {
        if (!v.questionId) continue;
        if (!voters[v.questionId]) voters[v.questionId] = [];
        if (v.email) voters[v.questionId].push(v.email);
      }
    }

    const questions: AdminEventQuestion[] = rows.map((r) => {
      const ev = eventMap.get(r.eventId);
      return {
        id: r.id,
        created_at: r.createdAt.toISOString(),
        event_id: r.eventId,
        event_name: ev?.name ?? "(unknown event)",
        event_route: ev?.route ?? null,
        email: r.email ?? "",
        question: r.question ?? "",
        approved: !!r.approved,
        reviewed: !!r.reviewed,
        duplicate: !!r.duplicate,
        hidden: !!r.hidden,
        votes: r.votes ?? 0,
        voters: voters[r.id] ?? [],
      };
    });

    return { questions };
  } catch (error) {
    console.error("Failed to fetch initial event questions:", error);
    return { questions: [] };
  }
}
