"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import ShareThanksModal from "./ShareThanksModal";
import type { Suggestion } from "./data";

type LeaderboardProps = {
  suggestions: Suggestion[];
  isLoggedIn: boolean;
  pinnedId?: string | null;
  autoVoteId?: string | null;
  autoShareId?: string | null;
};

const INITIAL_VISIBLE = 30;
const VOTE_SHARE_PROMPT_COOLDOWN_MS = 5 * 60 * 1000;
const VOTE_SHARE_PROMPT_LAST_SHOWN_KEY = "ssb:last-vote-share-prompt-at";

function rankColor(globalIndex: number): string {
  if (globalIndex <= 2) return "text-[#A80D0C]";
  return "text-zinc-700";
}

export default function Leaderboard({
  suggestions: initialSuggestions,
  isLoggedIn,
  pinnedId = null,
  autoVoteId = null,
  autoShareId = null,
}: LeaderboardProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [, startTransition] = useTransition();
  const [votingId, setVotingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [thanks, setThanks] = useState<{ id: string; speaker: string } | null>(
    null,
  );
  const autoVoteFiredRef = useRef(false);
  const autoShareFiredRef = useRef(false);
  const voteSharePromptLastShownRef = useRef(0);

  const openShare = (id: string, speaker: string) => {
    if (!speaker) return;
    setThanks({ id, speaker });
  };

  const canOpenVoteSharePrompt = () => {
    const now = Date.now();
    let lastShownAt = voteSharePromptLastShownRef.current;

    if (typeof window !== "undefined") {
      try {
        const storedLastShownAt = Number(
          window.localStorage.getItem(VOTE_SHARE_PROMPT_LAST_SHOWN_KEY),
        );
        if (Number.isFinite(storedLastShownAt)) {
          lastShownAt = Math.max(lastShownAt, storedLastShownAt);
        }
      } catch {
        // Ignore storage failures and fall back to the in-memory cooldown.
      }
    }

    if (now - lastShownAt < VOTE_SHARE_PROMPT_COOLDOWN_MS) {
      return false;
    }

    voteSharePromptLastShownRef.current = now;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          VOTE_SHARE_PROMPT_LAST_SHOWN_KEY,
          String(now),
        );
      } catch {
        // In-memory timestamp still prevents repeated prompts on this page.
      }
    }

    return true;
  };

  const openShareAfterVote = (id: string, speaker: string) => {
    if (!speaker || !canOpenVoteSharePrompt()) return;
    setThanks({ id, speaker });
  };

  const handleVote = async (speakerId: string, hasVoted: boolean) => {
    if (!isLoggedIn) return;

    setVotingId(speakerId);
    setError(null);

    const wasUnvoted = !hasVoted; // a click in unvoted state is an upvote (POST)
    const speakerName =
      suggestions.find((s) => s.id === speakerId)?.speaker ?? "";

    try {
      const response = await fetch("/api/vote", {
        method: hasVoted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_id: speakerId }),
      });

      const data = (await response.json()) as {
        alreadyVoted?: boolean;
        error?: string;
        newVoteCount?: number;
      };

      if (!response.ok) {
        if (data.alreadyVoted) {
          setSuggestions((prev) =>
            prev.map((s) =>
              s.id === speakerId ? { ...s, hasVoted: true } : s,
            ),
          );
          // The user just upvoted; server says they were already voted.
          // Either way they end up voted — surface the share prompt.
          if (wasUnvoted) openShareAfterVote(speakerId, speakerName);
        } else {
          setError(data.error || "Something went wrong");
        }
        return;
      }

      startTransition(() => {
        setSuggestions((prev) =>
          prev
            .map((s) =>
              s.id === speakerId
                ? {
                    ...s,
                    votes: data.newVoteCount ?? s.votes,
                    hasVoted: !hasVoted,
                  }
                : s,
            )
            .sort((a, b) => b.votes - a.votes),
        );
      });
      // Modal triggers on POST → voted transition only (not on DELETE/unvote).
      if (wasUnvoted) openShareAfterVote(speakerId, speakerName);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setVotingId(null);
    }
  };

  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return suggestions;
    const q = searchQuery.toLowerCase().trim();
    return suggestions.filter((s) => s.speaker.toLowerCase().includes(q));
  }, [suggestions, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;
  const visibleSlice = isSearching
    ? filteredSuggestions
    : filteredSuggestions.slice(0, visibleCount);

  // Pin the shared speaker to the top regardless of rank, and ensure they
  // appear even if they fall outside the initial visible window.
  const displayedSuggestions = useMemo(() => {
    if (!pinnedId) return visibleSlice;
    const pinned =
      visibleSlice.find((s) => s.id === pinnedId) ??
      filteredSuggestions.find((s) => s.id === pinnedId);
    if (!pinned) return visibleSlice;
    const rest = visibleSlice.filter((s) => s.id !== pinnedId);
    return [pinned, ...rest];
  }, [visibleSlice, filteredSuggestions, pinnedId]);

  const hasMore = !isSearching && filteredSuggestions.length > visibleCount;

  // Auto-vote on landing if requested (e.g. after returning from Stanford SSO).
  useEffect(() => {
    if (!autoVoteId || autoVoteFiredRef.current) return;
    autoVoteFiredRef.current = true;

    if (isLoggedIn) {
      const target = suggestions.find((s) => s.id === autoVoteId);
      if (target && !target.hasVoted) {
        void handleVote(autoVoteId, false);
      }
    }

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("vote")) {
        url.searchParams.delete("vote");
        router.replace(url.pathname + (url.search || ""));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open the share modal on landing if requested (e.g. from the
  // "Share & Rally Votes" CTA in the suggestion-approved email).
  useEffect(() => {
    if (!autoShareId || autoShareFiredRef.current) return;
    autoShareFiredRef.current = true;

    const target = suggestions.find((s) => s.id === autoShareId);
    if (target?.speaker) {
      openShare(autoShareId, target.speaker);
    }

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("share")) {
        url.searchParams.delete("share");
        router.replace(url.pathname + (url.search || ""));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search suggestions"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3 bg-[var(--ssb-card)] border border-zinc-800 rounded-full text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#A80D0C]/30 focus:border-[#A80D0C] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#A80D0C] transition-colors"
              aria-label="Clear search"
            >
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        {isSearching && (
          <p className="mt-2 text-xs text-zinc-500">
            {filteredSuggestions.length} of {suggestions.length} speakers
          </p>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 flex items-start gap-2 p-3 bg-red-950/30 rounded-md border border-red-900/50"
          >
            <svg
              width="18"
              height="18"
              className="text-red-500 shrink-0 translate-y-0.5"
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
            <p className="text-sm text-red-300">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-serif text-2xl text-zinc-500 mb-2">
            No suggestions yet.
          </p>
          <p className="font-sans text-sm text-zinc-500 max-w-xs">
            Be the first to suggest a speaker.
          </p>
        </div>
      ) : filteredSuggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-serif text-2xl text-zinc-500 mb-2">
            No matches.
          </p>
          <p className="font-sans text-sm text-zinc-500 max-w-xs">
            Try a different name.
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-zinc-900 border border-zinc-900 bg-[var(--ssb-card)] rounded-lg overflow-hidden">
          {displayedSuggestions.map((suggestion) => {
            const globalIndex = suggestions.findIndex(
              (s) => s.id === suggestion.id,
            );
            const rankNumber = globalIndex + 1;
            const isTopThree = globalIndex <= 2;
            const isPinned = !!pinnedId && suggestion.id === pinnedId;
            const ssoLink = `/api/auth/login?redirect_to=${encodeURIComponent(
              `/suggest/${suggestion.id}?vote=1`,
            )}`;
            return (
              <motion.li
                key={suggestion.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`group flex items-center gap-4 py-4 px-4 sm:px-6 transition-colors hover:bg-zinc-950 ${
                  isPinned
                    ? "bg-[#A80D0C]/[0.06] ring-1 ring-inset ring-[#A80D0C]/40"
                    : ""
                }`}
              >
                <span
                  className={`font-serif w-12 sm:w-14 text-right shrink-0 leading-none ${
                    isTopThree
                      ? "text-3xl sm:text-5xl"
                      : "text-xl sm:text-2xl"
                  } ${rankColor(globalIndex)}`}
                >
                  {rankNumber}
                </span>

                <div className="flex-1 min-w-0">
                  {isPinned && (
                    <p className="mb-1 text-[10px] font-sans uppercase tracking-[0.25em] text-[#A80D0C]">
                      Shared with you
                    </p>
                  )}
                  <p
                    className={`font-serif text-white truncate leading-tight ${
                      isTopThree ? "text-xl sm:text-2xl" : "text-base sm:text-lg"
                    }`}
                  >
                    {suggestion.speaker}
                  </p>
                </div>

                {isLoggedIn ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {suggestion.hasVoted && (
                      <motion.button
                        type="button"
                        onClick={() =>
                          openShare(suggestion.id, suggestion.speaker)
                        }
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label={`Share ${suggestion.speaker}`}
                        title="Share"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:border-[#A80D0C] hover:text-[#A80D0C]"
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                      </motion.button>
                    )}
                    <motion.button
                      onClick={() =>
                        handleVote(suggestion.id, suggestion.hasVoted)
                      }
                      disabled={votingId === suggestion.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                        ${
                          suggestion.hasVoted
                            ? "border border-[#A80D0C] text-[#A80D0C] bg-transparent hover:bg-[#A80D0C]/5"
                            : "bg-[#A80D0C] text-white shadow-md shadow-[#A80D0C]/10 hover:bg-[#C11211]"
                        }`}
                      aria-pressed={suggestion.hasVoted}
                    >
                      {votingId === suggestion.id ? (
                        <svg
                          className="animate-spin w-3.5 h-3.5"
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
                          <span>Voted</span>
                        </>
                      ) : (
                        <span>Vote</span>
                      )}
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <motion.button
                      type="button"
                      onClick={() =>
                        openShare(suggestion.id, suggestion.speaker)
                      }
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      aria-label={`Share ${suggestion.speaker}`}
                      title="Share"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:border-[#A80D0C] hover:text-[#A80D0C]"
                    >
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                    </motion.button>
                    {isPinned ? (
                      <a
                        href={ssoLink}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#A80D0C] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#A80D0C]/10 transition-colors hover:bg-[#C11211]"
                      >
                        Sign in to upvote
                      </a>
                    ) : (
                      <span className="text-[11px] font-sans uppercase tracking-[0.15em] text-zinc-600">
                        Sign in to vote
                      </span>
                    )}
                  </div>
                )}
              </motion.li>
            );
          })}
        </ol>
      )}

      <ShareThanksModal thanks={thanks} onClose={() => setThanks(null)} />

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + INITIAL_VISIBLE)}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-300 transition-colors hover:border-[#A80D0C] hover:text-[#A80D0C]"
          >
            Show more
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
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
