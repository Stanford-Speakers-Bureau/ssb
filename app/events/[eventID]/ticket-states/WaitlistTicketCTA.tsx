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
    <div>
      <div className="rounded-xl border border-amber-300 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] px-4 py-3 mb-4">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
              This event is sold out
            </p>
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-200/80 leading-relaxed">
              A waitlist ticket does <strong>not</strong> guarantee entry. Come to the venue in person
              and you&apos;ll be admitted if spots open up.
            </p>
          </div>
        </div>
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
