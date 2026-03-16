"use client";

import { TICKETING_NOTIFY_MESSAGES } from "@/app/lib/constants";
import { Spinner, PriorityBanner } from "../ui";

type TicketingOpensProps = {
  isLoggedIn: boolean;
  priorityText: string | null;
  hideTicketingDate: boolean;
  ticketingOpensAt: Date | null;
  formatTicketingOpensAt: (date: Date) => string;
  isLoadingNotify: boolean;
  isNotified: boolean;
  handleNotifyClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export default function TicketingOpens({
  isLoggedIn,
  priorityText,
  hideTicketingDate,
  ticketingOpensAt,
  formatTicketingOpensAt,
  isLoadingNotify,
  isNotified,
  handleNotifyClick,
}: TicketingOpensProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Bell icon */}
      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/10 flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      </div>

      {/* Date or "Coming Soon" */}
      {hideTicketingDate ? (
        <p className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white mb-1">
          Ticketing Opens Soon
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-medium mb-1">
            Ticketing opens
          </p>
          <p className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white">
            {formatTicketingOpensAt(ticketingOpensAt!)}
          </p>
        </>
      )}

      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
        {hideTicketingDate ? "Sign up to be notified when tickets are available." : "Date is subject to change. Sign up to be notified when ticketing opens."}
      </p>

      {/* Notify button */}
      <button
        onClick={handleNotifyClick}
        disabled={isLoadingNotify || isNotified}
        className={`w-full rounded-lg px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed ${isNotified
          ? "bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-300"
          : "bg-[#A80D0C] text-white hover:bg-[#C11211] hover:shadow-lg hover:shadow-red-900/20 disabled:opacity-50"
          }`}
      >
        {isLoadingNotify ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Spinner />
            {TICKETING_NOTIFY_MESSAGES.SIGNING_UP}
          </span>
        ) : isNotified ? (
          <span className="inline-flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            You&apos;ll be notified
          </span>
        ) : (
          "Notify Me"
        )}
      </button>

      {/* Priority notice */}
      {!isLoggedIn && priorityText && (
        <div className="mt-4 w-full">
          <PriorityBanner priorityText={priorityText} />
        </div>
      )}
    </div>
  );
}
