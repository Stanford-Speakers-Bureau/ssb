"use client";

import { PriorityBanner, RedButton, FeedbackMessage, ConfirmationModal } from "../ui";
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
      {!isLoggedIn && priorityText && (
        <div className="mb-4">
          <PriorityBanner priorityText={priorityText} />
        </div>
      )}

      {/* Live badge */}
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 mb-4">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Admitting Now</span>
      </span>

      <p className="text-md font-semibold text-zinc-900 dark:text-white mb-1.5">
        The standby line is open!
      </p>
      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-5">
        Grab a standby ticket below and head to the venue.
        You&apos;ll be admitted as spots become available — no guarantee, but many people get in.
      </p>

      {/* What to do */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
        {["Get your standby ticket", "Head to the venue", "Join the standby line"].map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-200 dark:bg-white/[0.08] border border-zinc-300 dark:border-white/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">{i + 1}</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">{step}</p>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <RedButton
        onClick={handleWaitlistTicketClick}
        disabled={isLoading}
        loading={isLoading}
        loadingText={TICKET_MESSAGES.CREATING}
      >
        Get Standby Ticket
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
