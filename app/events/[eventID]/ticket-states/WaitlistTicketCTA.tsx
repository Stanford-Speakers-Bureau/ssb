"use client";

import { RedButton, PriorityBanner, FeedbackMessage, ConfirmationModal } from "../ui";
import { TICKET_MESSAGES } from "../useTicketActions";

type WaitlistTicketCTAProps = {
  isLoggedIn: boolean;
  priorityText: string | null;
  isLoading: boolean;
  handleWaitlistTicketClick: () => void;
  message: string | null;
  showNoBagsModal: boolean;
  setShowNoBagsModal: (v: boolean) => void;
  noBagsConfirmation: string;
  setNoBagsConfirmation: (v: string) => void;
  handleConfirmNoBags: () => void;
};

export default function WaitlistTicketCTA({
  isLoggedIn,
  priorityText,
  isLoading,
  handleWaitlistTicketClick,
  message,
  showNoBagsModal,
  setShowNoBagsModal,
  noBagsConfirmation,
  setNoBagsConfirmation,
  handleConfirmNoBags,
}: WaitlistTicketCTAProps) {
  return (
    <div className="mb-5">
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 dark:border-yellow-500/20 dark:bg-yellow-500/[0.06] px-4 py-3 mb-4">
        <p className="text-sm sm:text-base text-yellow-800 dark:text-yellow-200/90 leading-relaxed">
          This event is sold out. Get a waitlist ticket below and come to
          the venue in person — you&apos;ll be admitted if spots open up.
        </p>
      </div>

      {!isLoggedIn && priorityText && (
        <div className="mb-4">
          <PriorityBanner priorityText={priorityText} />
        </div>
      )}

      <RedButton
        onClick={handleWaitlistTicketClick}
        disabled={isLoading}
        loading={isLoading}
        loadingText={TICKET_MESSAGES.CREATING}
      >
        Get Waitlist Ticket
      </RedButton>

      <FeedbackMessage message={message} />

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
    </div>
  );
}
