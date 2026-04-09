"use client";

import { TICKET_MESSAGES } from "../useTicketActions";

type HasTicketProps = {
  isLoading: boolean;
  isEventLongOver: boolean;
  openCancelModal: () => void;
};

export default function HasTicket({
  isLoading,
  isEventLongOver,
  openCancelModal,
}: HasTicketProps) {
  if (isEventLongOver) return null;

  return (
    <button
      onClick={openCancelModal}
      disabled={isLoading}
      className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/70 px-5 py-3.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed w-full"
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
          {TICKET_MESSAGES.CANCELLING}
        </>
      ) : (
        "Cancel Ticket"
      )}
    </button>
  );
}
