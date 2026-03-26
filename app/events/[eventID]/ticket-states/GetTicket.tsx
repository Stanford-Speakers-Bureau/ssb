"use client";

import { RedButton, PriorityBanner, ConfirmationModal, NoBagsModalChildren } from "../ui";
import { TICKET_MESSAGES } from "../useTicketActions";
import { useNoBagsConfirmation } from "./useNoBagsConfirmation";
import ReferralCodeInput from "./ReferralCodeInput";

type GetTicketProps = {
  isLoggedIn: boolean;
  priorityText: string | null;
  isLoading: boolean;
  isButtonDisabled: boolean;
  isSalesDisabled: boolean;
  processTicketRequest: () => void;
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
  processTicketRequest,
  referralsEnabled = false,
  referralCode = "",
  referralWarning = null,
  handleReferralCodeChange,
}: GetTicketProps) {
  const noBags = useNoBagsConfirmation(processTicketRequest);

  return (
    <>
      {!isLoggedIn && priorityText && (
        <div className="mb-4">
          <PriorityBanner priorityText={priorityText} />
        </div>
      )}

      {referralsEnabled && (
        <ReferralCodeInput
          code={referralCode}
          onChange={handleReferralCodeChange}
          warning={referralWarning}
        />
      )}

      <RedButton
        onClick={noBags.openModal}
        disabled={isButtonDisabled}
        loading={isLoading}
        loadingText={TICKET_MESSAGES.CREATING}
      >
        Get Ticket
      </RedButton>

      {isSalesDisabled && (
        <div className="flex min-h-[3rem] items-center justify-center">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 text-center">
            {TICKET_MESSAGES.EVENT_PASSED}
          </p>
        </div>
      )}

      <ConfirmationModal
        open={noBags.showModal}
        onClose={() => noBags.setShowModal(false)}
        title="No Bags Policy"
        description="This event has a strict no bags policy. You will be turned away at the entrance with any form of a bag or purse."
        cancelLabel="Cancel"
        confirmLabel="Proceed"
        onConfirm={noBags.handleConfirmNoBags}
        confirmDisabled={noBags.isConfirmDisabled}
      >
        <NoBagsModalChildren value={noBags.noBagsConfirmation} onChange={noBags.setNoBagsConfirmation} onConfirm={noBags.handleConfirmNoBags} />
      </ConfirmationModal>
    </>
  );
}
