import { getSessionUser } from "@/app/lib/auth";
import { getEventQuestions } from "./questions/data";
import { getQuestionsLifecycleState } from "./questions/lifecycle";
import QuestionsBarClient from "./QuestionsBarClient";

type EventInput = {
  id: string;
  doors_open?: string | Date | null;
  start_time_date?: string | Date | null;
  questions_enabled?: boolean | null;
  questions_rankings_hidden?: boolean | null;
};

// How many top-voted questions to surface in the inline strip. The rest live on
// the dedicated /questions page (reached via the top-bar links).
const TOP_N = 3;

export default async function QuestionsBar({
  event,
  eventRoute,
}: {
  event: EventInput;
  eventRoute: string;
}) {
  const lifecycleState = getQuestionsLifecycleState(event);
  const rankingsHidden = !!event.questions_rankings_hidden;

  const user = await getSessionUser();
  const all = await getEventQuestions(
    event.id,
    user?.email ?? null,
    rankingsHidden,
  );
  const total = all.length;
  const questions = all.slice(0, TOP_N);

  // Closed + no questions → nothing to show. Closed + has questions → render a
  // read-only list so people can still see what was asked.
  if (questions.length === 0 && lifecycleState !== "open") return null;

  return (
    <section className="relative w-full bg-gradient-to-b from-[var(--ssb-bg)] via-[var(--ssb-accent)]/15 to-[var(--ssb-bg)] my-6 sm:my-8">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--ssb-accent)]/60 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--ssb-accent)]/60 to-transparent"
      />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-4 sm:py-5">
        <QuestionsBarClient
          questions={questions}
          total={total}
          lifecycleState={lifecycleState}
          isSignedIn={!!user?.email}
          eventRoute={eventRoute}
          eventId={event.id}
          rankingsHidden={rankingsHidden}
        />
      </div>
    </section>
  );
}
