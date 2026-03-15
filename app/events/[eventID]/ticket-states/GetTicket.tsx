"use client";

import { RedButton, PriorityBanner, FeedbackMessage, ConfirmationModal } from "../ui";
import { TICKET_MESSAGES } from "../useTicketActions";

type GetTicketProps = {
  isLoggedIn: boolean;
  priorityText: string | null;
  isLoading: boolean;
  isButtonDisabled: boolean;
  isSalesDisabled: boolean;
  handleTicketClick: () => void;
  message: string | null;
  showNoBagsModal: boolean;
  setShowNoBagsModal: (v: boolean) => void;
  noBagsConfirmation: string;
  setNoBagsConfirmation: (v: string) => void;
  handleConfirmNoBags: () => void;
};

export default function GetTicket({
  isLoggedIn,
  priorityText,
  isLoading,
  isButtonDisabled,
  isSalesDisabled,
  handleTicketClick,
  message,
  showNoBagsModal,
  setShowNoBagsModal,
  noBagsConfirmation,
  setNoBagsConfirmation,
  handleConfirmNoBags,
}: GetTicketProps) {
  return (
    <>
      {!isLoggedIn && priorityText && (
        <div className="mb-4">
          <PriorityBanner priorityText={priorityText} />
        </div>
      )}

      <RedButton
        onClick={handleTicketClick}
        disabled={isButtonDisabled}
        loading={isLoading}
        loadingText={TICKET_MESSAGES.CREATING}
      >
        Get Ticket
      </RedButton>

      {isSalesDisabled && (
        <div className="flex min-h-[3rem] items-center justify-center">
          <p className="text-xs sm:text-sm text-yellow-400/80 text-center">
            {TICKET_MESSAGES.EVENT_PASSED}
          </p>
        </div>
      )}

      {!isSalesDisabled && <FeedbackMessage message={message} />}

      <ConfirmationModal
        open={showNoBagsModal}
        onClose={() => setShowNoBagsModal(false)}
        title="No Bags Policy"
        description="This event has a strict no bags policy. You will be turned away at the entrance with any form of a bag or purse."
        cancelLabel="Cancel"
        confirmLabel="Proceed"
        onConfirm={handleConfirmNoBags}
        confirmDisabled={noBagsConfirmation.toLowerCase().trim() !== "no bags"}
      >
        <p className="text-zinc-600 dark:text-zinc-300 mb-5 text-sm sm:text-base font-medium">
          Type &quot;no bags&quot; below to confirm you understand:
        </p>
        <input
          type="text"
          value={noBagsConfirmation}
          onChange={(e) => setNoBagsConfirmation(e.target.value)}
          placeholder="Type 'no bags' to confirm"
          className="w-full rounded-lg px-4 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/15 focus:ring-2 focus:ring-red-500/50 focus:outline-none focus:border-red-500/30 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 mb-5 transition-colors"
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              noBagsConfirmation.toLowerCase().trim() === "no bags"
            ) {
              handleConfirmNoBags();
            }
          }}
          autoFocus
        />
      </ConfirmationModal>
    </>
  );
}
