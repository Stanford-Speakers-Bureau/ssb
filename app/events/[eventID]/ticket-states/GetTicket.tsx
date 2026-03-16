"use client";

import { RedButton, PriorityBanner, ConfirmationModal, NoBagsModalChildren } from "../ui";
import { TICKET_MESSAGES } from "../useTicketActions";

type GetTicketProps = {
  isLoggedIn: boolean;
  priorityText: string | null;
  isLoading: boolean;
  isButtonDisabled: boolean;
  isSalesDisabled: boolean;
  handleTicketClick: () => void;
  showNoBagsModal: boolean;
  setShowNoBagsModal: (v: boolean) => void;
  noBagsConfirmation: string;
  setNoBagsConfirmation: (v: string) => void;
  handleConfirmNoBags: () => void;
  referralsEnabled?: boolean;
  referralCode?: string;
  referralWarning?: string | null;
  handleReferralCodeChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function GetTicket({
  isLoggedIn,
  priorityText,
  isLoading,
  isButtonDisabled,
  isSalesDisabled,
  handleTicketClick,
  showNoBagsModal,
  setShowNoBagsModal,
  noBagsConfirmation,
  setNoBagsConfirmation,
  handleConfirmNoBags,
  referralsEnabled = false,
  referralCode = "",
  referralWarning = null,
  handleReferralCodeChange,
}: GetTicketProps) {
  return (
    <>
      {!isLoggedIn && priorityText && (
        <div className="mb-4">
          <PriorityBanner priorityText={priorityText} />
        </div>
      )}

      {referralsEnabled && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
            Referral Code (optional)
          </label>
          <input
            type="text"
            value={referralCode}
            onChange={handleReferralCodeChange}
            placeholder="Enter referral code"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/40"
          />
          {referralWarning && (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">{referralWarning}</p>
          )}
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
