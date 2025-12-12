"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";

type Suggestion = {
  id: string;
  speaker: string;
  votes: number;
  hasVoted: boolean;
};

type UserSuggestion = {
  id: string;
  speaker: string;
  approved: boolean;
  reviewed: boolean;
};

type LeaderboardProps = {
  suggestions: Suggestion[];
  isLoggedIn: boolean;
  userSuggestions?: UserSuggestion[];
};

export default function Leaderboard({
  suggestions: initialSuggestions,
  isLoggedIn,
  userSuggestions = [],
}: LeaderboardProps) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [, startTransition] = useTransition();
  const [votingId, setVotingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVote = async (speakerId: string, hasVoted: boolean) => {
    if (!isLoggedIn) return;

    setVotingId(speakerId);
    setError(null);

    try {
      const response = await fetch("/api/vote", {
        method: hasVoted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_id: speakerId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.alreadyVoted) {
          // Update local state to reflect already voted
          setSuggestions((prev) =>
            prev.map((s) =>
              s.id === speakerId ? { ...s, hasVoted: true } : s,
            ),
          );
        } else {
          setError(data.error || "Something went wrong");
        }
        return;
      }

      // Update local state with new vote count and toggle hasVoted
      startTransition(() => {
        setSuggestions((prev) =>
          prev
            .map((s) =>
              s.id === speakerId
                ? { ...s, votes: data.newVoteCount, hasVoted: !hasVoted }
                : s,
            )
            .sort((a, b) => b.votes - a.votes),
        );
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div className="flex flex-col lg:flex-1 lg:h-full max-w-lg mx-0">
      <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-4 font-serif">
        Speaker Leaderboard
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 text-base leading-relaxed mb-6">
        Vote for the speakers you&apos;d most like to see at Stanford
      </p>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800"
          >
            <svg
              className="w-5 h-5 text-red-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-zinc-400 dark:text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              No suggestions yet
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
              Be the first to suggest a speaker you&apos;d like to see at
              Stanford!
            </p>
          </div>
        ) : (
          suggestions.map((suggestion, index) => (
            <motion.div
              key={suggestion.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.01, duration: 0.2 }}
              className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded"
            >
              {/* Rank */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
              ${
                index === 0
                  ? "bg-amber-400 text-amber-900"
                  : index === 1
                    ? "bg-zinc-300 text-zinc-700"
                    : index === 2
                      ? "bg-amber-600 text-amber-100"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
              }`}
              >
                {index + 1}
              </div>

              {/* Speaker Name */}
              <div className="flex-1 min-w-0">
                <p className="text-black dark:text-white font-medium truncate">
                  {suggestion.speaker}
                </p>
              </div>

              {/* Vote Count */}
              <div className="flex items-center gap-2">
                {/* Vote Button */}
                {isLoggedIn ? (
                  <motion.button
                    onClick={() =>
                      handleVote(suggestion.id, suggestion.hasVoted)
                    }
                    onMouseEnter={() => setHoveredId(suggestion.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onTouchEnd={() => setHoveredId(null)}
                    disabled={votingId === suggestion.id}
                    whileHover={{ scale: 1.05 }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all duration-150 active:scale-95
                    ${
                      suggestion.hasVoted
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400"
                        : "bg-[#A80D0C] hover:bg-[#8a0b0a] text-white shadow-sm hover:bg-[#C11211]"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {votingId === suggestion.id ? (
                      <svg
                        className="animate-spin w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : suggestion.hasVoted ? (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span
                          className={`${hoveredId === suggestion.id ? "hidden lg:inline" : ""}`}
                        >
                          Voted
                        </span>
                        <span
                          className={`${hoveredId === suggestion.id ? "lg:hidden" : "hidden"}`}
                        >
                          Unvote
                        </span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                        <span>Vote</span>
                      </>
                    )}
                  </motion.button>
                ) : (
                  <div className="text-xs text-zinc-400 dark:text-zinc-500">
                    Sign in to vote
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
