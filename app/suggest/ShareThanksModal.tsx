"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type ShareThanksModalProps = {
  thanks: { id: string; speaker: string } | null;
  onClose: () => void;
};

export default function ShareThanksModal({
  thanks,
  onClose,
}: ShareThanksModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const shareUrl = thanks ? `${origin}/suggest/${thanks.id}` : "";
  const copied = copiedId === thanks?.id;

  useEffect(() => {
    if (!thanks) return;
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
  }, [thanks, onClose]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(thanks?.id ?? null);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard blocked — fall back to selecting the input below.
    }
  };

  const shareText = thanks
    ? `Should ${thanks.speaker} come speak at Stanford? Vote here:`
    : "";

  const handleNativeShare = async () => {
    if (!shareUrl || typeof navigator === "undefined") return;
    if (!navigator.share) {
      handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: thanks
          ? `Should ${thanks.speaker} come speak at Stanford?`
          : "Stanford Speakers Bureau",
        text: shareText,
        url: shareUrl,
      });
    } catch {
      // user cancelled — ignore
    }
  };

  return (
    <AnimatePresence>
      {thanks && (
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
            aria-labelledby="share-thanks-title"
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

            <p className="text-xs font-sans uppercase tracking-[0.3em] text-[#A80D0C]">
              Thanks for voting
            </p>
            <h2
              id="share-thanks-title"
              className="mt-2 font-serif text-2xl text-white leading-tight"
            >
              Want {thanks.speaker} to actually show up?
            </h2>
            <p className="mt-2 font-sans text-sm text-zinc-400 leading-relaxed">
              Share this with friends. Every extra vote moves them up the list.
            </p>

            <div className="mt-5 flex items-stretch gap-2">
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
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleNativeShare}
                className="rounded-md border border-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-[#A80D0C] hover:text-white"
              >
                Share
              </button>
              <a
                href={`sms:?&body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                className="rounded-md border border-zinc-800 px-3 py-2.5 text-center text-sm font-semibold text-zinc-200 transition-colors hover:border-[#A80D0C] hover:text-white"
              >
                Text
              </a>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full text-center text-xs font-sans uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Back to leaderboard
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
