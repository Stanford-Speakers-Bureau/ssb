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
};

export default function WaitlistPosition({
  isWaitlistPositionReady,
  waitlistPosition,
  waitlistChance,
  isWaitlistLoading,
  showCancelModal,
  setShowCancelModal,
  handleLeaveWaitlist,
}: WaitlistPositionProps) {
  return (
    <div>
      {isWaitlistPositionReady && waitlistPosition !== null ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Waitlisted
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
                on the online waitlist
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
            {waitlistPosition === 1
              ? "You\u2019re next \u2014 the first spot that opens is yours."
              : waitlistPosition <= 3
                ? `Almost there \u2014 only ${waitlistPosition - 1} ${waitlistPosition === 2 ? "person" : "people"} ahead of you.`
                : "Many attendees flake \u2014 come in person to the venue and join the in person standby line, which is first come, first serve. Or, you can sit tight and we\u2019ll email your ticket the moment a spot opens."}
          </p>

          {/* In-person tip */}
          <div className="rounded-lg bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] px-3.5 py-2.5 mb-4">
            <div className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Want to improve your chances?</span> Come to the venue and join the in-person standby line — it&apos;s first come, first serve and runs independently from the online waitlist.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-zinc-200 dark:border-zinc-700/50 my-4" />

          {/* Bottom section - chance + info */}
          <div className="space-y-3">
            {waitlistChance?.toLowerCase() === "high" && (
              <div className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    High chance of getting a ticket
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Based on historical cancellation data
                  </p>
                </div>
              </div>
            )}

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
          </div>
        </>
      ) : (
        <>
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
