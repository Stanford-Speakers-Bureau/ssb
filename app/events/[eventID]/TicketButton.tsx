"use client";

import useTicketActions, { type TicketButtonProps } from "./useTicketActions";
import EventPassed from "./ticket-states/EventPassed";
import WaitlistTicketCTA from "./ticket-states/WaitlistTicketCTA";
import JoinWaitlist from "./ticket-states/JoinWaitlist";
import WaitlistPosition from "./ticket-states/WaitlistPosition";
import TicketingOpens from "./ticket-states/TicketingOpens";
import GetTicket from "./ticket-states/GetTicket";
import HasTicket from "./ticket-states/HasTicket";

export default function TicketButton(props: TicketButtonProps) {
  const actions = useTicketActions(props);

  // WAITLIST UI: If sold out and user doesn't have a ticket
  if (actions.isSoldOut && !actions.hasTicket) {
    if (actions.isEventLongOver) return <EventPassed />;

    if (actions.isWithinWaitlistCutoff) {
      return (
        <WaitlistTicketCTA
          isLoggedIn={actions.isLoggedIn}
          priorityText={actions.priorityText}
          isLoading={actions.isLoading}
          handleWaitlistTicketClick={actions.handleWaitlistTicketClick}
          message={actions.message}
          showNoBagsModal={actions.showNoBagsModal}
          setShowNoBagsModal={actions.setShowNoBagsModal}
          noBagsConfirmation={actions.noBagsConfirmation}
          setNoBagsConfirmation={actions.setNoBagsConfirmation}
          handleConfirmNoBags={actions.handleConfirmNoBags}
        />
      );
    }

    if (!actions.isOnWaitlist) {
      return (
        <JoinWaitlist
          isLoggedIn={actions.isLoggedIn}
          priorityText={actions.priorityText}
          isWaitlistStatusLoading={actions.isWaitlistStatusLoading}
          isWaitlistLoading={actions.isWaitlistLoading}
          referralWarning={actions.referralWarning}
          waitlistChance={actions.waitlistChance}
          handleJoinWaitlist={actions.handleJoinWaitlist}
          message={actions.message}
        />
      );
    }

    return (
      <WaitlistPosition
        isWaitlistPositionReady={actions.isWaitlistPositionReady}
        waitlistPosition={actions.waitlistPosition}
        waitlistChance={actions.waitlistChance}
        isWaitlistLoading={actions.isWaitlistLoading}
        showCancelModal={actions.showCancelModal}
        setShowCancelModal={actions.setShowCancelModal}
        handleLeaveWaitlist={actions.handleLeaveWaitlist}
        message={actions.message}
      />
    );
  }

  // Ticketing not open yet
  if (actions.showTicketingOpensOnly) {
    return (
      <TicketingOpens
        isLoggedIn={actions.isLoggedIn}
        priorityText={actions.priorityText}
        hideTicketingDate={actions.hideTicketingDate}
        ticketingOpensAt={actions.ticketingOpensAt}
        formatTicketingOpensAt={actions.formatTicketingOpensAt}
        isLoadingNotify={actions.isLoadingNotify}
        isNotified={actions.isNotified}
        notifyMessage={actions.notifyMessage}
        handleNotifyClick={actions.handleNotifyClick}
      />
    );
  }

  return (
    <div>
      {!actions.hasTicket && (
        <GetTicket
          isLoggedIn={actions.isLoggedIn}
          priorityText={actions.priorityText}
          isLoading={actions.isLoading}
          isButtonDisabled={actions.isButtonDisabled}
          isSalesDisabled={actions.isSalesDisabled}
          handleTicketClick={actions.handleTicketClick}
          message={actions.message}
          showNoBagsModal={actions.showNoBagsModal}
          setShowNoBagsModal={actions.setShowNoBagsModal}
          noBagsConfirmation={actions.noBagsConfirmation}
          setNoBagsConfirmation={actions.setNoBagsConfirmation}
          handleConfirmNoBags={actions.handleConfirmNoBags}
        />
      )}
      {actions.hasTicket && (
        <HasTicket
          isLoading={actions.isLoading}
          isCancelDisabled={actions.isCancelDisabled}
          hasEventStarted={actions.hasEventStarted}
          handleCancelTicket={actions.handleCancelTicket}
          showCancelTicketModal={actions.showCancelTicketModal}
          setShowCancelTicketModal={actions.setShowCancelTicketModal}
          message={actions.message}
        />
      )}
    </div>
  );
}
