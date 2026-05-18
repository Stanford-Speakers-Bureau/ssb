import Link from "next/link";
import { getSessionUser } from "@/app/lib/auth";
import { getEventQuestions } from "./questions/data";
import { getQuestionsLifecycleState } from "./questions/lifecycle";
import QuestionsBarClient from "./QuestionsBarClient";

type EventInput = {
  id: string;
  doors_open?: string | Date | null;
  start_time_date?: string | Date | null;
  questions_enabled?: boolean | null;
};

export default async function QuestionsBar({
  event,
  eventRoute,
}: {
  event: EventInput;
  eventRoute: string;
}) {
  const lifecycleState = getQuestionsLifecycleState(event);

  const user = await getSessionUser();
  const all = await getEventQuestions(event.id, user?.email ?? null);
  const questions = all.slice(0, 20);

  // Closed + no questions → nothing to show. Closed + has questions → render
  // read-only ticker so people can still see what was asked.
  if (questions.length === 0 && lifecycleState !== "open") return null;

  return (
    <section className="w-full bg-zinc-950 border-y border-zinc-900/60">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-3 sm:py-4">
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-flex items-center gap-2 shrink-0 text-xs font-sans uppercase tracking-[0.3em] text-[#A80D0C]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#A80D0C] animate-pulse" />
            Q&amp;A
          </span>
          <div className="flex-1 min-w-0">
            <QuestionsBarClient
              questions={questions}
              lifecycleState={lifecycleState}
              isSignedIn={!!user?.email}
              eventRoute={eventRoute}
              eventId={event.id}
            />
          </div>
          <Link
            href={`/events/${eventRoute}/questions`}
            prefetch={false}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#A80D0C]/15 ring-1 ring-[#A80D0C]/30 px-3 py-1.5 text-xs font-semibold text-[#FF8275] hover:bg-[#A80D0C]/25 hover:text-white transition-colors whitespace-nowrap"
          >
            Suggest
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
