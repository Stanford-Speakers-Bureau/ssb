"use client";

import { useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { FlatSpeaker } from "./types";

export default function SpeakerDrawer({
  speaker,
  image,
  onClose,
  onPrev,
  onNext,
  position,
  total,
}: {
  speaker: FlatSpeaker | null;
  image?: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  position: number;
  total: number;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!speaker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [speaker, onClose, onNext, onPrev]);

  const slideVariants = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { x: "100%" },
        animate: { x: 0 },
        exit: { x: "100%" },
      };

  return (
    <AnimatePresence>
      {speaker && (
        <motion.div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="speaker-drawer-title"
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          <motion.aside
            className="absolute right-0 top-0 h-full w-full sm:w-[min(580px,92vw)] bg-zinc-950 shadow-2xl flex flex-col"
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
          >
            {/* Header controls */}
            <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-zinc-900 shrink-0">
              <p className="text-xs font-sans uppercase tracking-[0.2em] text-zinc-500">
                {position} / {total} · {speaker.year}
              </p>
              <div className="flex items-center gap-2">
                <NavButton
                  onClick={onPrev}
                  label="Previous speaker"
                  direction="prev"
                />
                <NavButton
                  onClick={onNext}
                  label="Next speaker"
                  direction="next"
                />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="ml-2 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-300 hover:border-[#A80D0C] hover:text-[#A80D0C] transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {image && (
                <div className="relative w-full h-72 bg-zinc-900">
                  <Image
                    src={image}
                    alt={`${speaker.name} speaking at Stanford University from Stanford Speakers Bureau (SSB)`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 580px"
                  />
                </div>
              )}

              <div className="px-6 sm:px-10 py-8">
                <p className="text-xs font-sans uppercase tracking-[0.2em] text-[#A80D0C] mb-3">
                  {speaker.year} · Stanford Speakers Bureau
                </p>
                <h2
                  id="speaker-drawer-title"
                  className="font-serif text-4xl sm:text-5xl text-white leading-[0.95] mb-3"
                >
                  {speaker.name}
                </h2>
                {speaker.title && (
                  <p className="font-sans text-base sm:text-lg italic text-zinc-400 mb-6">
                    {speaker.title}
                  </p>
                )}
                <div className="h-px bg-gradient-to-r from-[#A80D0C] via-[#A80D0C]/30 to-transparent mb-6" />
                <p className="font-sans text-base text-zinc-300 leading-relaxed whitespace-pre-line">
                  {speaker.bio}
                </p>

                {speaker.videoUrl && speaker.videoLabel && (
                  <a
                    href={speaker.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#A80D0C] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#C11211]"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    {speaker.videoLabel}
                  </a>
                )}

                <p className="mt-10 text-xs font-sans uppercase tracking-[0.2em] text-zinc-400">
                  Use ← → to navigate · Esc to close
                </p>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NavButton({
  onClick,
  label,
  direction,
}: {
  onClick: () => void;
  label: string;
  direction: "prev" | "next";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-300 hover:border-[#A80D0C] hover:text-[#A80D0C] transition-colors"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {direction === "prev" ? (
          <path d="m15 18-6-6 6-6" />
        ) : (
          <path d="m9 18 6-6-6-6" />
        )}
      </svg>
    </button>
  );
}
