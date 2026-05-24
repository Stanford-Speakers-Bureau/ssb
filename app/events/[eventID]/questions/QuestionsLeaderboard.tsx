"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import QuestionSignInModal from "./QuestionSignInModal";
import type { EventQuestion } from "./data";
import type { QuestionsLifecycleState } from "./lifecycle";

type Props = {
  questions: EventQuestion[];
  isLoggedIn: boolean;
  lifecycleState: QuestionsLifecycleState;
  eventId: string;
  eventRoute: string;
  rankingsHidden: boolean;
};

function rankColor(globalIndex: number): string {
  if (globalIndex <= 2) return "text-[var(--ssb-accent-text)]";
  return "text-[var(--ssb-faint)]";
}

export default function QuestionsLeaderboard({
  questions: initial,
  isLoggedIn,
  lifecycleState,
  eventId,
  eventRoute,
  rankingsHidden,
}: Props) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initial);
  const [, startTransition] = useTransition();
  const [votingId, setVotingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signInPrompt, setSignInPrompt] = useState<{
    id: string;
    question: string;
  } | null>(null);

  const canVote = lifecycleState === "open";

  const handleVote = async (id: string, hasVoted: boolean) => {
    if (!isLoggedIn || !canVote) return;
    setVotingId(id);
    setError(null);

    try {
      const res = await fetch(
        `/api/events/${eventId}/questions/${id}/vote`,
        {
          method: hasVoted ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        alreadyVoted?: boolean;
        error?: string;
      };
      if (!res.ok) {
        if (data.alreadyVoted) {
          setQuestions((prev) =>
            prev.map((q) => (q.id === id ? { ...q, hasVoted: true } : q)),
          );
        } else {
          setError(data.error || "Something went wrong");
        }
        return;
      }
      startTransition(() => {
        setQuestions((prev) => {
          const updated = prev.map((q) =>
            q.id === id
              ? {
                  ...q,
                  hasVoted: !hasVoted,
                  votes: q.votes + (hasVoted ? -1 : 1),
                }
              : q,
          );
          // When rankings are hidden we keep the existing (shuffled) order so a
          // vote never reorders the list and leaks ranking to the public.
          if (rankingsHidden) return updated;
          return updated
            .sort((a, b) => b.votes - a.votes)
            .map((q, i) => ({ ...q, rank: i + 1 }));
        });
      });
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div className="flex flex-col">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 flex items-start gap-2 p-3 bg-red-950/30 rounded-md border border-red-900/50"
          >
            <p className="text-sm text-red-300">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-display text-2xl text-[var(--ssb-faint)] mb-2">
            No questions yet.
          </p>
          <p className="font-sans text-sm text-[var(--ssb-faint)] max-w-xs">
            Be the first to submit one.
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-[var(--ssb-border)] border border-[var(--ssb-border)] bg-[var(--ssb-card)] rounded-lg overflow-hidden">
          {questions.map((q, idx) => {
            const isTopThree = idx <= 2;
            return (
              <motion.li
                key={q.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="group flex items-start gap-3 sm:gap-5 py-4 px-3 sm:px-6 transition-colors hover:bg-[var(--ssb-card-strong)]"
              >
                {rankingsHidden ? (
                  <span
                    aria-hidden="true"
                    className="w-9 sm:w-14 shrink-0 flex justify-center pt-2"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--ssb-accent)]" />
                  </span>
                ) : (
                  <span
                    className={`font-display w-9 sm:w-14 text-right shrink-0 leading-none ${
                      isTopThree
                        ? "text-3xl sm:text-5xl"
                        : "text-xl sm:text-2xl"
                    } ${rankColor(idx)}`}
                  >
                    {idx + 1}
                  </span>
                )}
                <div className="flex-1 min-w-0 pt-1">
                  <p className="font-display text-[var(--ssb-ink-strong)] leading-snug text-base sm:text-xl">
                    {q.question}
                  </p>
                </div>
                <div className="shrink-0 pt-1">
                  {isLoggedIn ? (
                    <motion.button
                      onClick={() => handleVote(q.id, q.hasVoted)}
                      disabled={votingId === q.id || !canVote}
                      whileHover={canVote ? { scale: 1.03 } : {}}
                      whileTap={canVote ? { scale: 0.97 } : {}}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 sm:px-4 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        q.hasVoted
                          ? "border border-[var(--ssb-accent)] text-[var(--ssb-accent-text)] bg-transparent hover:bg-[var(--ssb-accent)]/5"
                          : "bg-[var(--ssb-accent)] text-[var(--ssb-accent-contrast)] shadow-md shadow-[var(--ssb-accent)]/10 hover:bg-[var(--ssb-accent-strong)]"
                      }`}
                      aria-pressed={q.hasVoted}
                    >
                      {q.hasVoted ? (
                        <>
                          <svg
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          Voted
                        </>
                      ) : (
                        "Vote"
                      )}
                    </motion.button>
                  ) : (
                    <motion.button
                      type="button"
                      onClick={() =>
                        setSignInPrompt({ id: q.id, question: q.question })
                      }
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--ssb-accent)] px-3 sm:px-4 text-xs font-semibold text-[var(--ssb-accent-contrast)] shadow-md shadow-[var(--ssb-accent)]/10 transition-colors hover:bg-[var(--ssb-accent-strong)]"
                    >
                      Vote
                    </motion.button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}

      <QuestionSignInModal
        open={signInPrompt}
        onClose={() => setSignInPrompt(null)}
        eventRoute={eventRoute}
      />
    </div>
  );
}
