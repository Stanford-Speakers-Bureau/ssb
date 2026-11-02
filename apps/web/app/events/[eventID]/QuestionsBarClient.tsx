"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QuestionSignInModal from "./questions/QuestionSignInModal";
import type { EventQuestion } from "./questions/data";
import type { QuestionsLifecycleState } from "./questions/lifecycle";

type Props = {
  questions: EventQuestion[]; // already sliced to the top N by the server
  total: number; // full approved count, used to gate the "See all" link
  lifecycleState: QuestionsLifecycleState;
  isSignedIn: boolean;
  eventRoute: string;
  eventId: string;
  rankingsHidden: boolean;
};

type VoteOutcome = "ok" | "already-voted" | "error";

export default function QuestionsBarClient({
  questions,
  total,
  lifecycleState,
  isSignedIn,
  eventRoute,
  eventId,
  rankingsHidden,
}: Props) {
  // Optimistic vote state, keyed by question id.
  const [votedById, setVotedById] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const q of questions) out[q.id] = q.hasVoted;
    return out;
  });
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const [signInPrompt, setSignInPrompt] = useState<{
    id: string;
    question: string;
  } | null>(null);

  // Re-sync if server-provided initial vote state changes (e.g. after sign-in).
  useEffect(() => {
    setVotedById((prev) => {
      const next = { ...prev };
      for (const q of questions) {
        if (next[q.id] === undefined) next[q.id] = q.hasVoted;
      }
      return next;
    });
  }, [questions]);

  const canVote = lifecycleState === "open";

  async function handleVote(
    id: string,
    wasVoted: boolean,
  ): Promise<VoteOutcome> {
    const optimistic = !wasVoted;
    setPendingById((p) => ({ ...p, [id]: true }));
    setVotedById((v) => ({ ...v, [id]: optimistic }));

    try {
      const res = await fetch(`/api/events/${eventId}/questions/${id}/vote`, {
        method: optimistic ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          alreadyVoted?: boolean;
        };
        if (data.alreadyVoted) {
          setVotedById((v) => ({ ...v, [id]: true }));
          return "already-voted";
        }
        setVotedById((v) => ({ ...v, [id]: wasVoted }));
        return "error";
      }
      return "ok";
    } catch {
      setVotedById((v) => ({ ...v, [id]: wasVoted }));
      return "error";
    } finally {
      setPendingById((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  }

  async function handleVoteClick(q: EventQuestion) {
    if (!canVote) return;
    if (!isSignedIn) {
      setSignInPrompt({ id: q.id, question: q.question });
      return;
    }
    if (pendingById[q.id]) return;
    const voted = votedById[q.id] ?? q.hasVoted;
    await handleVote(q.id, voted);
  }

  // Open + empty → invite the first question.
  if (questions.length === 0 && canVote) {
    return (
      <Link
        href={`/events/${eventRoute}/questions#ask`}
        prefetch={false}
        className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-[#A80D0C]/15 to-[#A80D0C]/5 border border-[#A80D0C]/30 px-4 py-3 transition-all hover:from-[#A80D0C]/25 hover:to-[#A80D0C]/10 hover:border-[#A80D0C]/50"
      >
        <span className="text-sm font-serif text-zinc-100">
          Be the first to suggest a question.
        </span>
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
    );
  }

  // Defensive: the server already returns null for closed + empty.
  if (questions.length === 0) return null;

  return (
    <>
      {/* Header: title on the left, actions on the right. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-sans text-base sm:text-lg font-semibold text-white">
            {canVote && (
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-red-500 motion-safe:animate-pulse"
              />
            )}
            Questions for the moderator
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canVote && (
            <Link
              href={`/events/${eventRoute}/questions#ask`}
              prefetch={false}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#A80D0C] px-4 text-sm font-semibold text-white shadow-sm shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Ask a question
            </Link>
          )}
          {total > questions.length && (
            <Link
              href={`/events/${eventRoute}/questions`}
              prefetch={false}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-4 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/[0.12] hover:border-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              See all {total}
              <svg
                width="14"
                height="14"
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
          )}
        </div>
      </div>

      {/* Question rows: full text wraps, labeled vote pill on the right. */}
      <ol className="mt-4 divide-y divide-white/10 border-y border-white/10">
        {questions.map((q, idx) => {
          const voted = votedById[q.id] ?? q.hasVoted;
          const pending = !!pendingById[q.id];
          return (
            <li key={q.id} className="flex items-start gap-3 py-3">
              {rankingsHidden ? (
                <span
                  aria-hidden="true"
                  className="shrink-0 w-5 flex justify-center pt-2.5 text-red-400"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                </span>
              ) : (
                <span className="shrink-0 w-5 pt-0.5 text-center font-serif text-base sm:text-lg text-red-400 tabular-nums">
                  {idx + 1}
                </span>
              )}
              <p className="flex-1 min-w-0 pt-0.5 font-serif text-base sm:text-lg leading-snug text-zinc-50 break-words">
                {q.question}
              </p>
              {canVote && (
                <button
                  type="button"
                  onClick={() => handleVoteClick(q)}
                  disabled={pending}
                  aria-pressed={voted}
                  aria-label={`${voted ? "Remove your vote for" : "Vote for"}: ${q.question}`}
                  title={voted ? "You voted for this. Click to undo." : "Vote for this question"}
                  className={`shrink-0 inline-flex h-9 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    voted
                      ? "bg-[#A80D0C] text-white border border-[#A80D0C] hover:bg-[#C11211]"
                      : "border border-white/25 text-zinc-100 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/40"
                  }`}
                >
                  {voted ? (
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M12 19V5" />
                      <path d="m5 12 7-7 7 7" />
                    </svg>
                  )}
                  {voted ? "Voted" : "Vote"}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <QuestionSignInModal
        open={signInPrompt}
        onClose={() => setSignInPrompt(null)}
        eventRoute={eventRoute}
        redirectTo={`/events/${eventRoute}`}
      />
    </>
  );
}
