"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

type SuggestionCardProps = {
  id: string;
  speaker: string;
  isLoggedIn: boolean;
  initialHasVoted: boolean;
  autoVote: boolean;
};

export default function SuggestionCard({
  id,
  speaker,
  isLoggedIn,
  initialHasVoted,
  autoVote,
}: SuggestionCardProps) {
  const router = useRouter();
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const submittedRef = useRef(false);

  const submitVote = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_id: id }),
      });
      const data = (await res.json()) as { alreadyVoted?: boolean; error?: string };
      if (res.ok || data.alreadyVoted) {
        setHasVoted(true);
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-vote on landing if requested (e.g. after returning from login).
  useEffect(() => {
    if (!autoVote || submittedRef.current) return;
    submittedRef.current = true;
    if (isLoggedIn && !initialHasVoted) {
      void submitVote();
    }
    // Strip the ?vote=1 param so a refresh doesn't re-trigger.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("vote")) {
        url.searchParams.delete("vote");
        router.replace(url.pathname + (url.search || ""));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = () => {
    if (!isLoggedIn) {
      const next = `/suggest/${id}?vote=1`;
      window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(next)}`;
      return;
    }
    if (hasVoted || submitting) return;
    void submitVote();
  };

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/suggest/${id}`
      : `/suggest/${id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-10 rounded-2xl border border-zinc-800 bg-[var(--ssb-card)] p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col items-center gap-5">
        <motion.button
          type="button"
          onClick={handleClick}
          disabled={submitting}
          whileHover={hasVoted ? undefined : { scale: 1.03 }}
          whileTap={hasVoted ? undefined : { scale: 0.97 }}
          className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed sm:text-base ${
            hasVoted
              ? "border border-[#A80D0C] text-[#A80D0C] bg-transparent"
              : "bg-[#A80D0C] text-white shadow-lg shadow-[#A80D0C]/25 hover:bg-[#C11211]"
          }`}
          aria-pressed={hasVoted}
        >
          {submitting ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
              <span>Submitting</span>
            </>
          ) : hasVoted ? (
            <>
              <svg
                width="14"
                height="14"
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
          ) : isLoggedIn ? (
            <span>Upvote {speaker}</span>
          ) : (
            <span>Sign in with Stanford to upvote</span>
          )}
        </motion.button>

        {error && <p className="text-xs text-red-300">{error}</p>}

        {hasVoted && (
          <div className="w-full mt-2">
            <p className="text-center font-serif text-lg text-white">
              Thanks for voting.
            </p>
            <p className="mt-1 text-center font-sans text-sm text-zinc-400">
              Pass it on — every share moves them up the list.
            </p>
            <div className="mt-4 flex items-stretch gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 rounded-md border border-zinc-800 bg-[var(--ssb-paper-strong)] px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#A80D0C]"
                aria-label="Share link"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-md bg-[#A80D0C] px-4 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#C11211]"
              >
                {shareCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
