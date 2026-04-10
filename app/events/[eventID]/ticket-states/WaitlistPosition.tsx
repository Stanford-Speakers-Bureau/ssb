"use client";

import { ConfirmationModal } from "../ui";

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

  return (
    <div>
      {isWaitlistPositionReady && waitlistPosition !== null && waitlistPosition <= 5 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
              <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
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
              ? "You\u2019re next \u2014 the first spot that opens is yours."
              : waitlistPosition <= 3
                ? `Almost there \u2014 only ${waitlistPosition - 1} ${waitlistPosition === 2 ? "person" : "people"} ahead of you.`
                : "Lots of people cancel or don\u2019t show up \u2014 you have a real shot at getting in."}
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
      ) : isWaitlistPositionReady ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
              <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
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
                We start letting people off the standby line at {formattedDoorsOpen} — arrive earlier to secure your spot
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
        <>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-4">
            Checking your spot in line...
          </p>
          <div className="h-5 w-24 rounded-full bg-zinc-200 dark:bg-white/[0.06] animate-pulse mb-5" />
          <div className="h-14 w-20 rounded bg-zinc-200 dark:bg-white/[0.06] animate-pulse mb-3" />
          <div className="h-3.5 w-full rounded bg-zinc-200 dark:bg-white/[0.06] animate-pulse mb-2" />
          <div className="h-3.5 w-3/4 rounded bg-zinc-200 dark:bg-white/[0.06] animate-pulse" />
        </>
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
