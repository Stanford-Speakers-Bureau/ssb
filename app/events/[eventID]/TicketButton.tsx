"use client";

import useTicketActions, { type TicketButtonProps } from "./useTicketActions";
import { FeedbackMessage } from "./ui";
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
      <FeedbackMessage message={actions.message} />
    </>
  );
}
