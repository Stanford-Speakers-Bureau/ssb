"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

type Props = {
  open: { id: string; question: string } | null;
  onClose: () => void;
  eventRoute: string;
  // Where to land after SSO. Defaults to the dedicated /questions page (used by
  // the leaderboard); the inline event-page card passes the event page itself.
  redirectTo?: string;
};

export default function QuestionSignInModal({
  open,
  onClose,
  eventRoute,
  redirectTo,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const ssoHref = open
    ? `/api/auth/login?redirect_to=${encodeURIComponent(
        redirectTo ?? `/events/${eventRoute}/questions`,
      )}`
    : "#";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 8 }}
            transition={{ type: "spring", duration: 0.45, bounce: 0.25 }}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[var(--ssb-card)] p-5 sm:p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h2 className="font-serif text-2xl text-white leading-tight">
              Sign in to vote
            </h2>
            <p className="mt-3 font-sans text-sm text-zinc-300 leading-relaxed line-clamp-3 italic">
              &ldquo;{open.question}&rdquo;
            </p>

            <a
              href={ssoHref}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#A80D0C] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#A80D0C]/10 transition-colors hover:bg-[#C11211]"
            >
              Continue with Stanford SSO
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12h14M13 5l7 7-7 7"
                />
              </svg>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full text-center text-xs font-sans uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
