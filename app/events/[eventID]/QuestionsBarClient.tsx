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
        className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-[var(--ssb-accent)]/15 to-[var(--ssb-accent)]/5 border border-[var(--ssb-accent)]/30 px-4 py-3 transition-all hover:from-[var(--ssb-accent)]/25 hover:to-[var(--ssb-accent)]/10 hover:border-[var(--ssb-accent)]/50"
      >
        <span className="text-sm font-display text-[var(--ssb-ink)]">
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
        <span className="inline-flex items-center gap-2 text-xs font-sans uppercase tracking-[0.25em] sm:tracking-[0.3em] text-[var(--ssb-accent-text)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ssb-accent)] motion-safe:animate-pulse" />
          Moderator Q&amp;A
        </span>
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold">
          {canVote && (
            <Link
              href={`/events/${eventRoute}/questions#ask`}
              prefetch={false}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--ssb-accent)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ssb-accent-contrast)] shadow-sm shadow-[var(--ssb-accent)]/20 transition-all hover:bg-[var(--ssb-accent-strong)] active:scale-95"
            >
              + Ask
            </Link>
          )}
          {total > questions.length && (
            <Link
              href={`/events/${eventRoute}/questions`}
              prefetch={false}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--ssb-border)] bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-[var(--ssb-muted)] transition-all hover:bg-white/[0.1] hover:text-[var(--ssb-ink-strong)] hover:border-[var(--ssb-border-strong)] active:scale-95"
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
      <ol className="mt-2 sm:mt-2.5 divide-y divide-[var(--ssb-border)]">
        {questions.map((q, idx) => {
          const voted = votedById[q.id] ?? q.hasVoted;
          const pending = !!pendingById[q.id];
          return (
            <li key={q.id} className="flex items-center gap-3 py-2 sm:py-2.5">
              {rankingsHidden ? (
                <span
                  aria-hidden="true"
                  className="shrink-0 w-4 flex justify-center text-[var(--ssb-accent-text)]"
                >
                  <span className="h-1 w-1 rounded-full bg-current" />
                </span>
              ) : (
                <span className="shrink-0 w-4 text-center font-display text-sm sm:text-base text-[var(--ssb-accent-text)] tabular-nums">
                  {idx + 1}
                </span>
              )}
              <span className="flex-1 min-w-0 truncate font-display text-sm sm:text-base text-[var(--ssb-ink)]">
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
                      ? "bg-[var(--ssb-accent)] text-[var(--ssb-accent-contrast)] border border-[var(--ssb-accent)] shadow-sm shadow-[var(--ssb-accent)]/30 hover:bg-[var(--ssb-accent-strong)]"
                      : "border border-[var(--ssb-accent)]/40 text-[var(--ssb-accent-text)] bg-[var(--ssb-accent)]/[0.06] hover:bg-[var(--ssb-accent)]/15 hover:border-[var(--ssb-accent)]/70"
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
