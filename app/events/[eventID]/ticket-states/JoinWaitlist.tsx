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
    <div className="mb-5">
      {!isLoggedIn && priorityText && (
        <div className="mb-4">
          <PriorityBanner priorityText={priorityText} />
        </div>
      )}

      {isWaitlistStatusLoading ? (
        <div className="mb-3">
          <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-900 p-6">
            <div className="h-4 w-20 rounded bg-white/10 animate-pulse mb-5" />
            <div className="h-7 w-48 rounded bg-white/10 animate-pulse mb-2" />
            <div className="h-4 w-64 max-w-full rounded bg-white/10 animate-pulse mb-6" />
            <div className="h-12 w-full rounded-xl bg-white/10 animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="relative rounded-2xl p-[1.5px]">
          {/* Animated gradient border - rotating conic gradient behind the card */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <motion.div
              className="absolute inset-[-50%]"
              style={{
                background:
                  "conic-gradient(from 0deg, #A80D0C, #ff4444, #ff6b6b, #A80D0C, #ff4444, #A80D0C)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <div className="relative rounded-[calc(1rem-1.5px)] bg-zinc-950 p-5 sm:p-6">
            {/* Sold out label */}
            <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-4">
              This event is Sold out
            </p>

            {/* Hero copy */}
            <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-1.5">
              Still want in?
            </h3>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed mb-6">
              Many attendees flake -{" "}
              <strong>
                come in person to the venue and join the in person standby
                line, which is first come, first serve.
              </strong>
              Spots open up when people don't show up. Or, you can join the
              online waitlist and we&apos;ll automatically grab you a ticket
              the moment one is available.
            </p>

            {/* Value props row */}
            {waitlistChance == "high" && (
              <div className="flex items-center gap-4 sm:gap-5 mb-6">
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  <span className="text-xs sm:text-sm text-zinc-300">
                    Instant delivery
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  <span className="text-xs sm:text-sm text-zinc-300">
                    High chance of getting a ticket
                  </span>
                </div>
              </div>
            )}

            {/* CTA Button */}
            <motion.button
              whileHover={
                isWaitlistLoading || !!referralWarning
                  ? {}
                  : { scale: 1.02 }
              }
              whileTap={
                isWaitlistLoading || !!referralWarning
                  ? {}
                  : { scale: 0.98 }
              }
              onClick={handleJoinWaitlist}
              disabled={isWaitlistLoading || !!referralWarning}
              className="relative w-full rounded-xl px-6 py-3.5 sm:py-4 text-base font-bold text-zinc-950 bg-white transition-all hover:bg-zinc-100 hover:shadow-lg hover:shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
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

            {waitlistChance === "High" && (
              <p className="text-center text-xs text-zinc-400 mt-2.5 font-medium">
                Based on historical cancelation data, you have a{" "}
                <strong>high chance</strong> of getting a ticket.
              </p>
            )}
          </div>
        </div>
      )}

      <FeedbackMessage message={message} />
    </div>
  );
}
