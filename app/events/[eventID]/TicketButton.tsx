"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import useTicketActions, { type TicketButtonProps } from "./useTicketActions";
import { ConfirmationModal, FeedbackMessage } from "./ui";
import EventPassed from "./ticket-states/EventPassed";
import StandbyTicketCTA from "./ticket-states/StandbyTicketCTA";
import WaitlistPosition from "./ticket-states/WaitlistPosition";
import TicketingOpens from "./ticket-states/TicketingOpens";
import GetTicket from "./ticket-states/GetTicket";
import HasTicket from "./ticket-states/HasTicket";

export default function TicketButton(props: TicketButtonProps) {
  const actions = useTicketActions(props);
  const ticketTypeLabel = actions.ticketType
    ? actions.ticketType.charAt(0).toUpperCase() + actions.ticketType.slice(1).toLowerCase()
    : null;
  const cancelTicketDesc = [
    "1",
    ticketTypeLabel,
    "ticket",
    actions.eventName ? `to ${actions.eventName}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const cancelTicketOwnerName =
    actions.emailCancelAttendeeName ?? props.initialTicketName ?? null;
  const cancelTitle = actions.initialIsScanned
    ? "Ticket Already Scanned"
    : "Cancel Ticket?";
  const cancelDescription = actions.initialIsScanned
    ? `The ${cancelTicketDesc}${cancelTicketOwnerName ? ` for ${cancelTicketOwnerName}` : ""} has already been scanned at the door and can no longer be cancelled.`
    : `Are you sure you want to cancel ${cancelTicketDesc}${cancelTicketOwnerName ? ` for ${cancelTicketOwnerName}` : ""}? You may not be able to get it back if you cancel.`;

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
        <div>
          <GetTicket
            isLoading={actions.isWaitlistLoading}
            isButtonDisabled={actions.isWaitlistStatusLoading || actions.isWaitlistLoading || !!actions.referralWarning}
            isSalesDisabled={false}
            processTicketRequest={actions.handleJoinWaitlist}
            isLoggedIn={actions.isLoggedIn}
            referralsEnabled={actions.referralsEnabled}
            referralCode={actions.referralCode}
            referralWarning={actions.referralWarning}
            handleReferralCodeChange={actions.handleReferralCodeChange}
          />
        </div>
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
          doorsOpen={actions.doorsOpen}
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
            isLoggedIn={actions.isLoggedIn}
            referralsEnabled={actions.referralsEnabled}
            referralCode={actions.referralCode}
            referralWarning={actions.referralWarning}
            handleReferralCodeChange={actions.handleReferralCodeChange}
          />
        )}
        {actions.hasTicket && (
          <HasTicket
            isLoading={actions.isLoading}
            isEventLongOver={actions.isEventLongOver}
            openCancelModal={() => actions.setShowCancelTicketModal(true)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      {content}
      <ConfirmationModal
        open={actions.showCancelTicketModal}
        onClose={actions.closeCancelTicketModal}
        title={cancelTitle}
        description={cancelDescription}
        cancelLabel={actions.initialIsScanned ? "OK" : "Keep Ticket"}
        confirmLabel={actions.initialIsScanned ? undefined : "Cancel Ticket"}
        onConfirm={actions.initialIsScanned ? undefined : actions.handleCancelTicket}
      />
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {actions.showIneligibleModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
              onClick={actions.closeIneligibleModal}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                className="bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/[0.08] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header with icon */}
                <div className="px-6 pt-6 pb-4 sm:px-7 sm:pt-7">
                  <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white mb-2">
                    {actions.ineligibleTitle}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {actions.ineligibleMessage}
                  </p>
                </div>

                {/* Links + contact section */}
                <div className="px-6 pb-2 sm:px-7 space-y-3">
                  {actions.showIneligibleLinks && (
                    <div className="flex gap-2">
                      <a
                        href={actions.ineligibleAssuUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.08]"
                      >
                        Visit ASSU
                      </a>
                      <a
                        href={actions.ineligibleFaqUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.08]"
                      >
                        Read the FAQ
                      </a>
                    </div>
                  )}

                  <div className="rounded-lg bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Think this is an error? Contact{" "}
                        <a href="mailto:tickets@stanfordspeakersbureau.com" className="font-medium text-zinc-700 dark:text-zinc-300 underline underline-offset-2">
                          tickets@stanfordspeakersbureau.com
                        </a>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Close button */}
                <div className="px-6 py-4 sm:px-7 sm:py-5">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={actions.closeIneligibleModal}
                    className="w-full rounded-lg border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/[0.06] px-6 py-3 text-sm sm:text-base font-semibold text-zinc-700 dark:text-zinc-200 transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:text-zinc-900 dark:hover:text-white"
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
      <FeedbackMessage message={actions.message} />
    </>
  );
}
