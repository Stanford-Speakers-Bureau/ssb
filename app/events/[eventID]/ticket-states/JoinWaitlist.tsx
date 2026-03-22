"use client";

import { PriorityBanner, RedButton } from "../ui";
import ReferralCodeInput from "./ReferralCodeInput";

type JoinWaitlistProps = {
  isLoggedIn: boolean;
  priorityText: string | null;
  isWaitlistStatusLoading: boolean;
  isWaitlistLoading: boolean;
  referralWarning: string | null;
  waitlistChance: string | null;
  handleJoinWaitlist: () => void;
  referralsEnabled?: boolean;
  referralCode?: string;
  handleReferralCodeChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function JoinWaitlist({
  isLoggedIn,
  priorityText,
  isWaitlistStatusLoading,
  isWaitlistLoading,
  referralWarning,
  waitlistChance,
  handleJoinWaitlist,
  referralsEnabled = false,
  referralCode = "",
  handleReferralCodeChange,
}: JoinWaitlistProps) {
  return (
    <div>
      {isWaitlistStatusLoading ? (
        <>
          <div className="h-5 w-24 rounded-full bg-zinc-200 dark:bg-white/[0.06] animate-pulse mb-4" />
          <div className="h-4 w-64 max-w-full rounded bg-zinc-200 dark:bg-white/[0.06] animate-pulse mb-5" />
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <div className="rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] p-3.5 h-24 animate-pulse" />
            <div className="rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] p-3.5 h-24 animate-pulse" />
          </div>
          <div className="h-12 w-full rounded-lg bg-zinc-200 dark:bg-white/[0.06] animate-pulse" />
        </>
      ) : (
        <>
          {/* Sold out badge */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Waitlist Available</span>
          </span>

          <p className="text-md text-zinc-500 dark:text-zinc-200 font-medium mb-3">Still want in? You have two options!</p>

          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {/* Option 1: Online waitlist */}
            <div className="rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] p-3.5">
              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-white/[0.06] border border-zinc-300 dark:border-white/10 flex items-center justify-center mb-2.5">
                <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-snug">Join the online waitlist</p>
              <p className="text-xs text-zinc-500 leading-relaxed mt-1">
                We&apos;ll email you a ticket when a spot opens.
              </p>
            </div>

            {/* Option 2: In-person standby */}
            <div className="rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] p-3.5">
              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-white/[0.06] border border-zinc-300 dark:border-white/10 flex items-center justify-center mb-2.5">
                <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-snug">Show up in person</p>
              <p className="text-xs text-zinc-500 leading-relaxed mt-1">
                Join the standby line — first come, first serve.
              </p>
            </div>
          </div>

          <p className="text-sm font-medium text-zinc-400 text-center mb-5">We recommend doing both to maximize your chances.</p>

          {/* High chance indicator */}
          {waitlistChance?.toLowerCase() === "high" && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/[0.06] border border-emerald-200/60 dark:border-emerald-500/15">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
              <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                High chance of getting a ticket based on historical data
              </p>
            </div>
          )}

          {/* Referral code input */}
          {referralsEnabled && (
            <ReferralCodeInput
              code={referralCode}
              onChange={handleReferralCodeChange}
              warning={referralWarning}
            />
          )}

          {/* CTA Button */}
          <RedButton
            onClick={handleJoinWaitlist}
            disabled={isWaitlistLoading || !!referralWarning}
            loading={isWaitlistLoading}
            loadingText="Joining..."
          >
            Join Online Waitlist
          </RedButton>
        </>
      )}

    </div>
  );
}
