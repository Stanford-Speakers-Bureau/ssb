"use client";

import { motion } from "motion/react";
import { PriorityBanner, Spinner, FeedbackMessage } from "../ui";

type JoinWaitlistProps = {
  isLoggedIn: boolean;
  priorityText: string | null;
  isWaitlistStatusLoading: boolean;
  isWaitlistLoading: boolean;
  referralWarning: string | null;
  waitlistChance: string | null;
  handleJoinWaitlist: () => void;
  message: string | null;
};

export default function JoinWaitlist({
  isLoggedIn,
  priorityText,
  isWaitlistStatusLoading,
  isWaitlistLoading,
  referralWarning,
  waitlistChance,
  handleJoinWaitlist,
  message,
}: JoinWaitlistProps) {
  return (
    <div>
      {!isLoggedIn && priorityText && (
        <div className="mb-4">
          <PriorityBanner priorityText={priorityText} />
        </div>
      )}

      {isWaitlistStatusLoading ? (
        <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-900 p-6">
          <div className="h-4 w-20 rounded bg-white/10 animate-pulse mb-5" />
          <div className="h-7 w-48 rounded bg-white/10 animate-pulse mb-2" />
          <div className="h-4 w-64 max-w-full rounded bg-white/10 animate-pulse mb-6" />
          <div className="h-12 w-full rounded-xl bg-white/10 animate-pulse" />
        </div>
      ) : (
        <div className="rounded-2xl bg-zinc-950 dark:bg-zinc-950 border border-zinc-800 p-5 sm:p-6">
          {/* Sold out badge */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Sold Out</span>
          </span>

          {/* Two options */}
          <div className="space-y-4 mb-6">
            {/* Option 1: Online waitlist */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mt-0.5">
                <svg className="w-3.5 h-3.5 text-zinc-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Join the online waitlist</p>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mt-0.5">
                  We&apos;ll email you a ticket the moment a spot opens up.
                </p>
              </div>
            </div>
          </div>

          {/* High chance indicator */}
          {(waitlistChance === "high" || waitlistChance === "High") && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
              <p className="text-xs sm:text-sm text-emerald-300 font-medium">
                High chance of getting a ticket based on historical data
              </p>
            </div>
          )}

          {/* CTA Button */}
          <motion.button
            whileHover={
              isWaitlistLoading || !!referralWarning ? {} : { scale: 1.02 }
            }
            whileTap={
              isWaitlistLoading || !!referralWarning ? {} : { scale: 0.98 }
            }
            onClick={handleJoinWaitlist}
            disabled={isWaitlistLoading || !!referralWarning}
            className="relative w-full rounded-xl px-6 py-3.5 text-sm sm:text-base font-bold text-zinc-950 bg-white transition-all hover:bg-zinc-100 hover:shadow-lg hover:shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isWaitlistLoading ? (
                <>
                  <Spinner className="border-zinc-300 border-t-zinc-900" />
                  Joining...
                </>
              ) : (
                "Join Waitlist"
              )}
            </span>
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-zinc-200/40 to-transparent" />
          </motion.button>
        </div>
      )}

      <FeedbackMessage message={message} />
    </div>
  );
}
