"use client";

import useTicketActions, { type TicketButtonProps } from "./useTicketActions";
import { ConfirmationModal, FeedbackMessage } from "./ui";
import EventPassed from "./ticket-states/EventPassed";
import StandbyTicketCTA from "./ticket-states/StandbyTicketCTA";
import JoinWaitlist from "./ticket-states/JoinWaitlist";
import WaitlistPosition from "./ticket-states/WaitlistPosition";
import TicketingOpens from "./ticket-states/TicketingOpens";
import GetTicket from "./ticket-states/GetTicket";
import HasTicket from "./ticket-states/HasTicket";

export default function TicketButton(props: TicketButtonProps) {
  const actions = useTicketActions(props);

  let content: React.ReactNode;

  if (!actions.hasTicket && actions.isEventLongOver) {
    content = <EventPassed />;
  } else if (!actions.hasTicket && actions.isStandbyMode) {
    content = (
      <StandbyTicketCTA
        isLoading={actions.isLoading}
        processStandbyTicketRequest={actions.processStandbyTicketRequest}
      />
    );
  } else if (actions.isSoldOut && !actions.hasTicket) {
    if (!actions.isOnWaitlist) {
      content = (
        <JoinWaitlist
          isWaitlistStatusLoading={actions.isWaitlistStatusLoading}
          isWaitlistLoading={actions.isWaitlistLoading}
          referralWarning={actions.referralWarning}
          waitlistChance={actions.waitlistChance}
          handleJoinWaitlist={actions.handleJoinWaitlist}
          referralsEnabled={actions.referralsEnabled}
          referralCode={actions.referralCode}
          handleReferralCodeChange={actions.handleReferralCodeChange}
        />
      );
    } else {
      content = (
        <WaitlistPosition
          isWaitlistPositionReady={actions.isWaitlistPositionReady}
          waitlistPosition={actions.waitlistPosition}
          waitlistChance={actions.waitlistChance}
          isWaitlistLoading={actions.isWaitlistLoading}
          showCancelModal={actions.showCancelModal}
          setShowCancelModal={actions.setShowCancelModal}
          handleLeaveWaitlist={actions.handleLeaveWaitlist}
        />
      );
    }
  } else if (actions.showTicketingOpensOnly) {
    content = (
      <TicketingOpens
        hideTicketingDate={actions.hideTicketingDate}
        ticketingOpensAt={actions.ticketingOpensAt}
        formatTicketingOpensAt={actions.formatTicketingOpensAt}
        isLoadingNotify={actions.isLoadingNotify}
        isNotified={actions.isNotified}
        handleNotifyClick={actions.handleNotifyClick}
      />
    );
  } else {
    content = (
      <div>
        {!actions.hasTicket && (
          <GetTicket
            isLoading={actions.isLoading}
            isButtonDisabled={actions.isButtonDisabled}
            isSalesDisabled={actions.isSalesDisabled}
            processTicketRequest={actions.processTicketRequest}
            referralsEnabled={actions.referralsEnabled}
            referralCode={actions.referralCode}
            referralWarning={actions.referralWarning}
            handleReferralCodeChange={actions.handleReferralCodeChange}
          />
        )}
        {actions.hasTicket && (
          <HasTicket
            isLoading={actions.isLoading}
            isScanned={actions.initialIsScanned}
            isEventLongOver={actions.isEventLongOver}
            handleCancelTicket={actions.handleCancelTicket}
            showCancelTicketModal={actions.showCancelTicketModal}
            setShowCancelTicketModal={actions.setShowCancelTicketModal}
          />
        )}
      </div>
    );
  }

  return (
    <>
      {content}
      <ConfirmationModal
        open={actions.showIneligibleModal}
        onClose={actions.closeIneligibleModal}
        title={actions.ineligibleTitle}
        description={actions.ineligibleMessage}
        cancelLabel="Close"
      >
        {actions.showIneligibleLinks && (
          <div className="flex flex-col gap-3 text-sm">
            <a
              href={actions.ineligibleAssuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#A80D0C] underline underline-offset-2 hover:text-[#C11211]"
            >
              Visit ASSU
            </a>
            <a
              href={actions.ineligibleFaqUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#A80D0C] underline underline-offset-2 hover:text-[#C11211]"
            >
              Read the FAQ
            </a>
          </div>
        )}
      </ConfirmationModal>
      <FeedbackMessage message={actions.message} />
    </>
  );
}
