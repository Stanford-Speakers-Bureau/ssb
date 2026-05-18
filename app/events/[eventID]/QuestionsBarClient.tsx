"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { EventQuestion } from "./questions/data";
import type { QuestionsLifecycleState } from "./questions/lifecycle";

type Props = {
  questions: EventQuestion[];
  lifecycleState: QuestionsLifecycleState;
  isSignedIn: boolean;
  eventRoute: string;
  eventId: string;
};

type VoteOutcome = "ok" | "already-voted" | "error";

function rankColor(rank: number): string {
  if (rank <= 3) return "text-[#A80D0C]";
  return "text-zinc-600";
}

function SignInModal({
  open,
  onClose,
  redirectPath,
}: {
  open: boolean;
  onClose: () => void;
  redirectPath: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;
  const ssoHref = `/api/auth/login?redirect_to=${encodeURIComponent(
    redirectPath,
  )}`;
  // Portal to <body> so we escape any ancestor stacking context
  // (e.g. the marquee wrapper that uses mask-image).
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl"
      >
        <h3 className="text-lg font-serif text-white mb-5">
          Sign in to vote
        </h3>
        <div className="flex flex-col gap-2">
          <a
            href={ssoHref}
            className="inline-flex items-center justify-center rounded-lg bg-[#A80D0C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#C11211] transition-colors"
          >
            Sign in with Stanford
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function UpvoteButton({
  hasVoted,
  pending,
  disabled,
  showRipple,
  onClick,
}: {
  hasVoted: boolean;
  pending: boolean;
  disabled: boolean;
  showRipple: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      aria-pressed={hasVoted}
      aria-label={hasVoted ? "Remove upvote" : "Upvote"}
      className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full overflow-visible transition-colors duration-300 disabled:cursor-not-allowed ${
        hasVoted
          ? "bg-[#A80D0C] text-white shadow-md shadow-[#A80D0C]/30 hover:bg-[#C11211]"
          : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 ring-1 ring-zinc-700/60"
      }`}
    >
      <AnimatePresence>
        {showRipple && (
          <motion.span
            key="ripple"
            initial={{ scale: 0.7, opacity: 0.7 }}
            animate={{ scale: 2.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 rounded-full bg-[#A80D0C]"
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {pending ? (
          <motion.svg
            key="spin"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
            className="animate-spin"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="3"
            />
            <path
              d="M21 12a9 9 0 0 1-9 9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </motion.svg>
        ) : (
          <motion.svg
            key={hasVoted ? "voted" : "vote"}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.18 }}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={hasVoted ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 15 7-7 7 7" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function TickerItem({
  question,
  hasVoted,
  pending,
  canVote,
  isSignedIn,
  onVote,
  onRequireSignIn,
}: {
  question: EventQuestion;
  hasVoted: boolean;
  pending: boolean;
  canVote: boolean;
  isSignedIn: boolean;
  onVote: (id: string, wasVoted: boolean) => Promise<VoteOutcome>;
  onRequireSignIn: () => void;
}) {
  const [showRipple, setShowRipple] = useState(false);
  const rippleTimer = useRef<number | null>(null);

  const flashRipple = useCallback(() => {
    setShowRipple(true);
    if (rippleTimer.current) window.clearTimeout(rippleTimer.current);
    rippleTimer.current = window.setTimeout(() => {
      setShowRipple(false);
      rippleTimer.current = null;
    }, 650);
  }, []);

  useEffect(() => {
    return () => {
      if (rippleTimer.current) window.clearTimeout(rippleTimer.current);
    };
  }, []);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canVote) return;
      if (!isSignedIn) {
        onRequireSignIn();
        return;
      }
      if (pending) return;
      const wasVoted = hasVoted;
      const outcome = await onVote(question.id, wasVoted);
      if (!wasVoted && (outcome === "ok" || outcome === "already-voted")) {
        flashRipple();
      }
    },
    [
      canVote,
      isSignedIn,
      pending,
      hasVoted,
      question.id,
      onVote,
      onRequireSignIn,
      flashRipple,
    ],
  );

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
      <span
        className={`font-serif font-bold text-sm sm:text-base ${rankColor(
          question.rank,
        )}`}
      >
        #{question.rank}
      </span>
      <span className="font-serif text-sm sm:text-base text-zinc-100">
        {question.question}
      </span>
      <UpvoteButton
        hasVoted={hasVoted}
        pending={pending}
        disabled={!canVote || pending}
        showRipple={showRipple}
        onClick={handleClick}
      />
    </span>
  );
}

function Separator() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1 w-1 shrink-0 rounded-full bg-[#A80D0C]/60"
    />
  );
}

export default function QuestionsBarClient({
  questions,
  lifecycleState,
  isSignedIn,
  eventRoute,
  eventId,
}: Props) {
  // Lift vote state up so duplicated marquee items stay in sync.
  const [votedById, setVotedById] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const q of questions) out[q.id] = q.hasVoted;
    return out;
  });
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const [signInOpen, setSignInOpen] = useState(false);
  const redirectPath = useRef(
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : `/events/${eventRoute}`,
  );

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

  const handleRequireSignIn = useCallback(() => {
    if (typeof window !== "undefined") {
      redirectPath.current = window.location.pathname + window.location.search;
    }
    setSignInOpen(true);
  }, []);

  const handleVote = useCallback(
    async (id: string, wasVoted: boolean): Promise<VoteOutcome> => {
      const optimistic = !wasVoted;
      setPendingById((p) => ({ ...p, [id]: true }));
      setVotedById((v) => ({ ...v, [id]: optimistic }));

      try {
        const res = await fetch(
          `/api/events/${eventId}/questions/${id}/vote`,
          {
            method: optimistic ? "POST" : "DELETE",
            headers: { "Content-Type": "application/json" },
          },
        );
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
    },
    [eventId],
  );

  const canVote = lifecycleState === "open";

  // Target sweep speed in pixels per second. Constant regardless of font
  // size, breakpoint, or content length.
  const TARGET_PX_PER_SEC = 180;

  const trackRef = useRef<HTMLDivElement>(null);
  // Conservative initial guess so the animation has a duration before the
  // first measurement lands. Updated below from the actual rendered width.
  const [duration, setDuration] = useState(20);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      // The track has the question list duplicated so the marquee can loop
      // seamlessly; animated distance is half the rendered scrollWidth.
      const animated = el.scrollWidth / 2;
      if (animated > 0) {
        setDuration(Math.max(4, animated / TARGET_PX_PER_SEC));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [questions]);

  if (questions.length === 0 && lifecycleState === "open") {
    return (
      <>
        <Link
          href={`/events/${eventRoute}/questions`}
          prefetch={false}
          className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-[#A80D0C]/15 to-[#A80D0C]/5 border border-[#A80D0C]/30 px-4 py-3 transition-all hover:from-[#A80D0C]/25 hover:to-[#A80D0C]/10 hover:border-[#A80D0C]/50"
        >
          <span className="text-sm font-serif text-zinc-100">
            Be the first to suggest a question.
          </span>
        </Link>
        <SignInModal
          open={signInOpen}
          onClose={() => setSignInOpen(false)}
          redirectPath={redirectPath.current}
        />
      </>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  const track = [...questions, ...questions];

  return (
    <>
      <div
        className="ssb-q-marquee-wrap relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
        }}
      >
        <style>{`
          @keyframes ssb-q-marquee {
            from { transform: translate3d(0, 0, 0); }
            to   { transform: translate3d(-50%, 0, 0); }
          }
          .ssb-q-marquee-wrap .ssb-q-marquee-track {
            animation: ssb-q-marquee var(--ssb-q-duration, 60s) linear infinite;
            animation-play-state: running;
          }
          .ssb-q-marquee-wrap:hover .ssb-q-marquee-track,
          .ssb-q-marquee-wrap:focus-within .ssb-q-marquee-track {
            animation-play-state: paused;
          }
          @media (prefers-reduced-motion: reduce) {
            .ssb-q-marquee-wrap .ssb-q-marquee-track {
              animation: none;
            }
          }
        `}</style>
        <div
          ref={trackRef}
          className="ssb-q-marquee-track flex items-center gap-6 whitespace-nowrap will-change-transform py-2"
          style={
            {
              ["--ssb-q-duration" as string]: `${duration}s`,
            } as React.CSSProperties
          }
        >
          {track.map((q, idx) => (
            <span key={`${q.id}-${idx}`} className="flex items-center gap-6">
              <TickerItem
                question={q}
                hasVoted={votedById[q.id] ?? q.hasVoted}
                pending={!!pendingById[q.id]}
                canVote={canVote}
                isSignedIn={isSignedIn}
                onVote={handleVote}
                onRequireSignIn={handleRequireSignIn}
              />
              <Separator />
            </span>
          ))}
        </div>
      </div>
      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        redirectPath={redirectPath.current}
      />
    </>
  );
}
