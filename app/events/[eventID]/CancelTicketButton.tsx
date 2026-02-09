"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

type CancelTicketButtonProps = {
  eventId: string;
  eventStartTime?: string | null;
};

const CANCEL_MESSAGES = {
  DELETED: "Ticket cancelled successfully!",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_LIVE_EVENT: "Cannot cancel tickets while an event is live.",
  ERROR_EVENT_STARTED_OR_ENDED:
    "Cannot cancel tickets after the event has started.",
  CANCELLING: "Cancelling ticket...",
} as const;

export default function CancelTicketButton({
  eventId,
  eventStartTime = null,
}: CancelTicketButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLiveEvent, setIsLiveEvent] = useState(false);
  const [showCancelTicketModal, setShowCancelTicketModal] = useState(false);

  const hasEventStarted = eventStartTime
    ? new Date() >= new Date(eventStartTime)
    : false;

  const isCancelDisabled = isLiveEvent || hasEventStarted;

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const checkLiveEvent = useCallback(async () => {
    try {
      const response = await fetch("/api/events/live");
      const data = (await response.json()) as { liveEvent?: { id: string }[] };
      setIsLiveEvent(data.liveEvent?.[0]?.id == eventId || false);
    } catch (error) {
      console.error("Error checking live event:", error);
      setIsLiveEvent(false);
    }
  }, [eventId]);

  const handleCancelTicket = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    setShowCancelTicketModal(false);

    try {
      await checkLiveEvent();

      const response = await fetch("/api/tickets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });

      const data = (await response.json()) as { error?: string };

      if (response.ok) {
        setMessage(CANCEL_MESSAGES.DELETED);
        window.dispatchEvent(
          new CustomEvent("ticketChanged", {
            detail: { hasTicket: false, ticketId: null, ticketName: null },
          }),
        );
      } else {
        setMessage(data.error || CANCEL_MESSAGES.ERROR_GENERIC);
      }
    } catch {
      setMessage(CANCEL_MESSAGES.ERROR_GENERIC);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, checkLiveEvent]);

  if (isCancelDisabled) {
    return (
      <div className="flex min-h-[3rem] items-center justify-center">
        <p className="text-xs sm:text-sm text-yellow-400/80 text-center">
          {hasEventStarted
            ? CANCEL_MESSAGES.ERROR_EVENT_STARTED_OR_ENDED
            : CANCEL_MESSAGES.ERROR_LIVE_EVENT}
        </p>
      </div>
    );
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowCancelTicketModal(true)}
        disabled={isLoading}
        className="rounded-lg border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/[0.06] px-6 py-3 text-sm sm:text-base font-semibold text-zinc-700 dark:text-zinc-200 transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/25 disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        {isLoading ? CANCEL_MESSAGES.CANCELLING : "Cancel Ticket"}
      </motion.button>

      {message && (
        <p
          className={`mt-3 text-xs sm:text-sm ${
            message.includes("successfully") ? "text-green-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showCancelTicketModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
                onClick={() => setShowCancelTicketModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 10 }}
                  transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                  className="bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white mb-3">
                    Cancel Ticket?
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-sm sm:text-base leading-relaxed">
                    Are you sure you want to cancel your ticket? You may not be able
                    to get your ticket back if you cancel.
                  </p>
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCancelTicketModal(false)}
                      className="flex-1 px-4 py-2.5 text-sm sm:text-base font-semibold text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/[0.06] rounded-lg transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:border-zinc-300 dark:hover:border-white/25"
                    >
                      Keep Ticket
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCancelTicket}
                      className="flex-1 px-4 py-2.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] rounded-lg transition-all hover:bg-[#C11211] hover:shadow-lg hover:shadow-red-900/20"
                    >
                      Cancel Ticket
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
