"use client";

import { RedButton, PriorityBanner, FeedbackMessage, ConfirmationModal, NoBagsModalChildren } from "../ui";
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
        <NoBagsModalChildren value={noBagsConfirmation} onChange={setNoBagsConfirmation} onConfirm={handleConfirmNoBags} />
      </ConfirmationModal>
    </>
  );
}
