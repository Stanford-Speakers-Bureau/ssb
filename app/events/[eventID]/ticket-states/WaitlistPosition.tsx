"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmationModal } from "../ui";

const ACTIVITY_MESSAGES = [
  "Monitoring for cancellations",
  "Checking ticket availability",
  "Scanning the waitlist queue",
  "Refreshing your status",
  "Watching for open spots",
];

type WaitlistPositionProps = {
  isWaitlistPositionReady: boolean;
  waitlistPosition: number | null;
  waitlistChance: string | null;
  isWaitlistLoading: boolean;
  showCancelModal: boolean;
  setShowCancelModal: (v: boolean) => void;
  handleLeaveWaitlist: () => void;
  doorsOpen?: string | null;
};

export default function WaitlistPosition({
  isWaitlistPositionReady,
  waitlistPosition,
  waitlistChance,
  isWaitlistLoading,
  showCancelModal,
  setShowCancelModal,
  handleLeaveWaitlist,
  doorsOpen = null,
}: WaitlistPositionProps) {
  const isHighChance = waitlistChance?.toLowerCase() === "high";

  const formattedDoorsOpen = doorsOpen
    ? new Date(doorsOpen).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })
    : null;

  // Loading step progression
  const loadingSteps = [
    "Checking the waitlist",
    "Finding your spot in line",
    "Almost ready",
  ];
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (isWaitlistPositionReady) return;
    setLoadingStep(0);
    const t1 = setTimeout(() => setLoadingStep(1), 1400);
    const t2 = setTimeout(() => setLoadingStep(2), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isWaitlistPositionReady]);

  const ringCircumference = 176;
  const ringProgress = [0.3, 0.6, 0.92];

  // Live activity cycling for the waitlist view
  const [activityIndex, setActivityIndex] = useState(0);
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (!isWaitlistPositionReady) return;
    const interval = setInterval(() => {
      setActivityIndex((i) => (i + 1) % ACTIVITY_MESSAGES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isWaitlistPositionReady]);

  useEffect(() => {
    if (!isWaitlistPositionReady) return;
    const interval = setInterval(() => {
      setSecondsAgo((s) => {
        if (s >= 27) {
          setActivityIndex(0);
          return 0;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isWaitlistPositionReady]);

  const liveActivityBlock = (
    <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-500/[0.04] border border-emerald-200/40 dark:border-emerald-500/10 p-3.5 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 animate-spin shrink-0"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 2a10 10 0 1 0 10 10"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </svg>
          <div className="overflow-hidden h-4 flex items-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={activityIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="text-xs font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
              >
                {ACTIVITY_MESSAGES[activityIndex]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        <span className="text-[10px] text-emerald-600/50 dark:text-emerald-400/30 tabular-nums shrink-0 ml-2">
          {secondsAgo === 0 ? "Just now" : `${secondsAgo}s ago`}
        </span>
      </div>
      <div className="h-[3px] rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 overflow-hidden">
        <motion.div
          className="h-full w-2/5 rounded-full bg-emerald-400/50 dark:bg-emerald-400/20"
          animate={{ x: ["-100%", "300%"] }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
            repeatDelay: 0.3,
          }}
        />
      </div>
    </div>
  );

  return (
    <div>
      {isWaitlistPositionReady && waitlistPosition !== null && waitlistPosition <= 5 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                On the Waitlist
              </span>
            </span>
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={isWaitlistLoading}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
            >
              Leave
            </button>
          </div>

          {/* Position hero */}
          <div className="mb-3">
            <div className="flex items-baseline gap-2.5">
              <span className="text-5xl sm:text-6xl font-black text-zinc-900 dark:text-white tracking-tighter tabular-nums leading-none">
                #{waitlistPosition}
              </span>
              <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
                on the waitlist
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
            {waitlistPosition === 1
              ? "You\u2019re next. The first spot that opens is yours."
              : waitlistPosition <= 3
                ? `Almost there! Only ${waitlistPosition - 1} ${waitlistPosition === 2 ? "person" : "people"} ahead of you.`
                : "Lots of people cancel or don\u2019t show up so you have a real shot at getting in."}
          </p>

          {/* High chance indicator */}
          {isHighChance && (
            <div className="flex items-center gap-2.5 mb-4 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200/60 dark:border-emerald-500/20">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  High chance of getting in
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Based on past similar events
                </p>
              </div>
            </div>
          )}

          {liveActivityBlock}

          {/* Divider */}
          <div className="border-t border-dashed border-zinc-200 dark:border-zinc-700/50 my-4" />

          {/* Show up CTA — hero section */}
          <div className="rounded-xl bg-zinc-900 dark:bg-white/[0.06] border border-zinc-800 dark:border-white/[0.08] p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-white dark:text-zinc-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white dark:text-white">
                Show up for the best chance
              </p>
            </div>
            {formattedDoorsOpen && (
              <p className="text-sm font-semibold text-white dark:text-white mb-2">
                We start letting people off the standby line at {formattedDoorsOpen} — arrive earlier to secure your spot
              </p>
            )}
            <p className="text-xs text-zinc-300 dark:text-zinc-400 leading-relaxed mb-3">
              The in-person standby line runs independently from the online waitlist. Many ticket holders don&apos;t show up, if you arrive early you&apos;re very likely to get in.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-zinc-300 dark:text-zinc-400">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>First come, first served</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-300 dark:text-zinc-400">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>Separate from online waitlist</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-300 dark:text-zinc-400">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>Admitted as no-shows are called</span>
              </div>
            </div>
          </div>

          {/* Compact info row */}
          <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              <span>Auto-assigned</span>
            </div>
            <span className="text-zinc-200 dark:text-zinc-700">&middot;</span>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <span>Emailed instantly</span>
            </div>
          </div>
        </>
      ) : isWaitlistPositionReady ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                On the Waitlist
              </span>
            </span>
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={isWaitlistLoading}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
            >
              Leave
            </button>
          </div>

          <p className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white mb-2">
            You&apos;re on the list!
          </p>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
            We&apos;ll email you a ticket the moment a spot opens up.
          </p>

          {/* High chance indicator */}
          {isHighChance && (
            <div className="flex items-center gap-2.5 mb-4 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200/60 dark:border-emerald-500/20">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  High chance of getting in
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Based on past similar events
                </p>
              </div>
            </div>
          )}

          {liveActivityBlock}

          <div className="border-t border-dashed border-zinc-200 dark:border-zinc-700/50 my-4" />

          {/* Show up CTA */}
          <div className="rounded-xl bg-zinc-900 dark:bg-white/[0.06] border border-zinc-800 dark:border-white/[0.08] p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-white dark:text-zinc-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white dark:text-white">
                Show up for the best chance
              </p>
            </div>
            {formattedDoorsOpen && (
              <p className="text-sm font-semibold text-white dark:text-white mb-2">
                We start letting people off the standby line at {formattedDoorsOpen}. Arrive early to secure your spot!
              </p>
            )}
            <p className="text-xs text-zinc-300 dark:text-zinc-400 leading-relaxed mb-3">
              The in-person standby line runs independently from the online waitlist. Many ticket holders don&apos;t show — arrive as early as possible for the best chance of getting in.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-zinc-300 dark:text-zinc-400">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>First come, first served</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-300 dark:text-zinc-400">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>Separate from online waitlist</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-300 dark:text-zinc-400">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>Admitted as no-shows are called</span>
              </div>
            </div>
          </div>

          {/* Compact info row */}
          <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              <span>Auto-assigned</span>
            </div>
            <span className="text-zinc-200 dark:text-zinc-700">&middot;</span>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <span>Emailed instantly</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center py-4">
          {/* Animated progress ring */}
          <div className="relative w-20 h-20 mb-5">
            {/* Subtle rotating background ring */}
            <motion.svg
              className="absolute inset-0 w-20 h-20"
              viewBox="0 0 64 64"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <circle
                cx="32" cy="32" r="28" fill="none"
                strokeWidth="2"
                strokeDasharray="4 8"
                className="stroke-zinc-200 dark:stroke-zinc-700/50"
              />
            </motion.svg>

            {/* Progress ring */}
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32" cy="32" r="28" fill="none"
                strokeWidth="3.5"
                className="stroke-zinc-200 dark:stroke-zinc-800"
              />
              <motion.circle
                cx="32" cy="32" r="28" fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="stroke-emerald-500 dark:stroke-emerald-400"
                strokeDasharray={ringCircumference}
                initial={{ strokeDashoffset: ringCircumference }}
                animate={{
                  strokeDashoffset:
                    ringCircumference * (1 - ringProgress[loadingStep]),
                }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>

            {/* Center ticket icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.svg
                className="w-7 h-7 text-emerald-600 dark:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.4 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
              </motion.svg>
            </div>
          </div>

          {/* Animated step text */}
          <div className="h-6 flex items-center justify-center mb-3">
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="text-sm font-semibold text-zinc-800 dark:text-zinc-100"
              >
                {loadingSteps[loadingStep]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress bar */}
          <div className="w-48 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden mb-3">
            <motion.div
              className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
              initial={{ width: "0%" }}
              animate={{
                width: `${ringProgress[loadingStep] * 100}%`,
              }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>

          {/* Step dots */}
          <div className="flex gap-2 mb-5">
            {loadingSteps.map((_, i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                animate={{
                  backgroundColor:
                    i <= loadingStep
                      ? "rgb(16 185 129)"
                      : "rgb(228 228 231)",
                  scale: i === loadingStep ? 1.3 : 1,
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
            We&apos;ll email you the moment a spot opens
          </p>
        </div>
      )}

      <ConfirmationModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Leave Waitlist?"
        description="You'll lose your spot. You can rejoin, but you'll be placed at the end of the line."
        cancelLabel="Keep My Spot"
        confirmLabel="Leave"
        onConfirm={handleLeaveWaitlist}
      />
    </div>
  );
}
