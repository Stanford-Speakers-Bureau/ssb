"use client";

import { ConfirmationModal } from "../ui";
import { TICKET_MESSAGES } from "../useTicketActions";

type HasTicketProps = {
  isLoading: boolean;
  isScanned: boolean;
  isEventLongOver: boolean;
  handleCancelTicket: () => void;
  showCancelTicketModal: boolean;
  setShowCancelTicketModal: (v: boolean) => void;
};

export default function HasTicket({
  isLoading,
  isScanned,
  isEventLongOver,
  handleCancelTicket,
  showCancelTicketModal,
  setShowCancelTicketModal,
}: HasTicketProps) {
  if (isEventLongOver) return null;

  return (
    <>
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
          "Cancel Ticket"
        )}
      </button>

      <ConfirmationModal
        open={showCancelTicketModal}
        onClose={() => setShowCancelTicketModal(false)}
        title={isScanned ? "Ticket Already Scanned" : "Cancel Ticket?"}
        description={
          isScanned
            ? "This ticket has already been scanned at the door and can no longer be cancelled."
            : "Are you sure you want to cancel your ticket? You may not be able to get your ticket back if you cancel."
        }
        cancelLabel={isScanned ? "OK" : "Keep Ticket"}
        confirmLabel={isScanned ? undefined : "Cancel Ticket"}
        onConfirm={isScanned ? undefined : handleCancelTicket}
      />
    </>
  );
}
