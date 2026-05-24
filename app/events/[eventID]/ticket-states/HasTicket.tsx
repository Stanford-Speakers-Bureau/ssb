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
      className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[var(--ssb-card)] border border-[var(--ssb-border)] px-5 py-3.5 text-sm font-medium text-[var(--ssb-muted)] transition-all hover:bg-[var(--ssb-card-strong)] hover:text-[var(--ssb-ink-strong)] hover:border-[var(--ssb-border-strong)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed w-full"
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-[var(--ssb-muted)] border-t-[var(--ssb-faint)] rounded-full animate-spin" />
          {TICKET_MESSAGES.CANCELLING}
        </>
      ) : (
        "Cancel Ticket"
      )}
    </button>
  );
}
