"use client";

import { FeedbackMessage, ConfirmationModal } from "../ui";
import { TICKET_MESSAGES } from "../useTicketActions";

type HasTicketProps = {
  isLoading: boolean;
  isCancelDisabled: boolean;
  hasEventStarted: boolean;
  handleCancelTicket: () => void;
  showCancelTicketModal: boolean;
  setShowCancelTicketModal: (v: boolean) => void;
  message: string | null;
};

export default function HasTicket({
  isLoading,
  isCancelDisabled,
  hasEventStarted,
  handleCancelTicket,
  showCancelTicketModal,
  setShowCancelTicketModal,
  message,
}: HasTicketProps) {
  return (
    <>
      {!isCancelDisabled && (
        <button
          onClick={() => setShowCancelTicketModal(true)}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/70 px-5 py-3.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed w-full"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
              {TICKET_MESSAGES.CANCELLING}
            </>
          ) : (
            <>
              Cancel Ticket
            </>
          )}
        </button>
      )}

      {isCancelDisabled && (
        <div className="flex min-h-[3rem] items-center justify-center">
          <p className="text-xs sm:text-sm text-yellow-400/80 text-center">
            {hasEventStarted
              ? TICKET_MESSAGES.EVENT_OVER_WITH_TICKET
              : TICKET_MESSAGES.ERROR_LIVE_EVENT}
          </p>
        </div>
      )}

      {!isCancelDisabled && <FeedbackMessage message={message} />}

      <ConfirmationModal
        open={showCancelTicketModal}
        onClose={() => setShowCancelTicketModal(false)}
        title="Cancel Ticket?"
        description="Are you sure you want to cancel your ticket? You may not be able to get your ticket back if you cancel."
        cancelLabel="Keep Ticket"
        confirmLabel="Cancel Ticket"
        onConfirm={handleCancelTicket}
      />
    </>
  );
}
