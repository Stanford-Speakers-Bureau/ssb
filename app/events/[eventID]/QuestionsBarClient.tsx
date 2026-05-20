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
};

type VoteOutcome = "ok" | "already-voted" | "error";

export default function QuestionsBarClient({
  questions,
  total,
  lifecycleState,
  isSignedIn,
  eventRoute,
  eventId,
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
        const { [id]: _drop, ...rest } = p;
        return rest;
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
      {/* Top bar: label on the left, inline actions on the right. */}
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-sans uppercase tracking-[0.25em] sm:tracking-[0.3em] text-[#A80D0C]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#A80D0C] motion-safe:animate-pulse" />
          Moderator Q&amp;A
        </span>
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold">
          {canVote && (
            <Link
              href={`/events/${eventRoute}/questions#ask`}
              prefetch={false}
              className="inline-flex items-center gap-1 rounded-full bg-[#A80D0C] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#A80D0C]/20 transition-all hover:bg-[#C11211] active:scale-95"
            >
              + Ask
            </Link>
          )}
          {total > questions.length && (
            <Link
              href={`/events/${eventRoute}/questions`}
              prefetch={false}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/[0.1] hover:text-white hover:border-white/25 active:scale-95"
            >
              See all
              <svg
                width="12"
                height="12"
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

      {/* Compact one-line rows. */}
      <ol className="mt-2 sm:mt-2.5 divide-y divide-white/10">
        {questions.map((q, idx) => {
          const voted = votedById[q.id] ?? q.hasVoted;
          const pending = !!pendingById[q.id];
          return (
            <li key={q.id} className="flex items-center gap-3 py-2 sm:py-2.5">
              <span className="shrink-0 w-4 text-center font-serif text-sm sm:text-base text-[#A80D0C] tabular-nums">
                {idx + 1}
              </span>
              <span className="flex-1 min-w-0 truncate font-serif text-sm sm:text-base text-zinc-100">
                {q.question}
              </span>
              {canVote && (
                <button
                  type="button"
                  onClick={() => handleVoteClick(q)}
                  disabled={pending}
                  aria-pressed={voted}
                  aria-label={voted ? "Remove vote" : "Vote"}
                  className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed ${
                    voted
                      ? "bg-[#A80D0C] text-white border border-[#A80D0C] shadow-sm shadow-[#A80D0C]/30 hover:bg-[#C11211]"
                      : "border border-[#A80D0C]/40 text-[#A80D0C] bg-[#A80D0C]/[0.06] hover:bg-[#A80D0C]/15 hover:border-[#A80D0C]/70"
                  }`}
                >
                  {voted ? (
                    <svg
                      width="13"
                      height="13"
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
                      width="13"
                      height="13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M12 19V5" />
                      <path d="m5 12 7-7 7 7" />
                    </svg>
                  )}
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
