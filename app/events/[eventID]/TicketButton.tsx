"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import TicketQRCode from "./TicketQRCode";

type TicketButtonProps = {
  eventId: string;
  initialHasTicket?: boolean;
  initialTicketId?: string | null;
};

const TICKET_MESSAGES = {
  SUCCESS: "Ticket created successfully!",
  DELETED: "Ticket cancelled successfully!",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in.",
  ERROR_ALREADY_HAS_TICKET: "You already have a ticket for this event.",
  ERROR_NO_TICKET: "You don't have a ticket for this event.",
  ERROR_CAPACITY_EXCEEDED: "This event is at full capacity.",
  ERROR_LIVE_EVENT: "Cannot cancel tickets while an event is live.",
  CREATING: "Creating ticket...",
  CANCELLING: "Cancelling ticket...",
} as const;

export default function TicketButton({
  eventId,
  initialHasTicket = false,
  initialTicketId = null,
}: TicketButtonProps) {
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [ticketId, setTicketId] = useState<string | null>(initialTicketId);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLiveEvent, setIsLiveEvent] = useState(false);
  const autoTicketProcessed = useRef(false);

  useEffect(() => {
    // Clear message after 3 seconds
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const checkLiveEvent = useCallback(async () => {
    try {
      const response = await fetch("/api/events/live");
      const data = await response.json();
      setIsLiveEvent(data.liveEvent?.[0]?.id == eventId || false);
    } catch (error) {
      console.error("Error checking live event:", error);
      setIsLiveEvent(false);
    }
  }, [eventId]);

  const handleTicketClick = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      await checkLiveEvent();

      const url = hasTicket ? "/api/ticket" : "/api/ticket";
      const method = hasTicket ? "DELETE" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });

      if (response.status === 401) {
        // Not authenticated, redirect to Google sign-in with auto_ticket flag
        const currentPath = window.location.pathname;
        const redirectUrl = `${currentPath}?ticket=true`;
        window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(redirectUrl)}`;
        return;
      }

      const data = await response.json();

      if (response.ok) {
        if (hasTicket) {
          // Cancelling ticket
          setHasTicket(false);
          setTicketId(null);
          setMessage(TICKET_MESSAGES.DELETED);
        } else {
          // Creating ticket
          setHasTicket(true);
          setTicketId(data.ticketId || null);
          setMessage(TICKET_MESSAGES.SUCCESS);
        }
        // Dispatch event to update ticket count
        window.dispatchEvent(new CustomEvent("ticketChanged"));
      } else {
        const errorMessage = data.error || TICKET_MESSAGES.ERROR_GENERIC;
        setMessage(errorMessage);
        // If it's a live event error, update the live event state
        if (errorMessage === TICKET_MESSAGES.ERROR_LIVE_EVENT) {
          setIsLiveEvent(true);
        }
      }
    } catch {
      setMessage(TICKET_MESSAGES.ERROR_GENERIC);
    } finally {
      setIsLoading(false);
    }
  }, [checkLiveEvent, eventId, hasTicket]);

  // Auto-create ticket after redirect from authentication.
  // Note: React 18 StrictMode (dev) mounts/unmounts effects twice, so we persist intent in sessionStorage
  // before removing `ticket=true` from the URL.
  useEffect(() => {
    const autoTicketKey = `auto_ticket_pending:${eventId}`;
    const url = new URL(window.location.href);
    const autoTicketParam = url.searchParams.get("ticket");

    if (autoTicketParam === "true") {
      sessionStorage.setItem(autoTicketKey, "1");
      url.searchParams.delete("ticket");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [eventId]);

  useEffect(() => {
    const autoTicketKey = `auto_ticket_pending:${eventId}`;
    const pending = sessionStorage.getItem(autoTicketKey) === "1";
    if (!pending) return;
    if (autoTicketProcessed.current) return;
    if (hasTicket) {
      sessionStorage.removeItem(autoTicketKey);
      return;
    }

    autoTicketProcessed.current = true;
    sessionStorage.removeItem(autoTicketKey);
    void handleTicketClick();
  }, [eventId, handleTicketClick, hasTicket]);

  const isCancelDisabled = hasTicket && isLiveEvent;
  const isButtonDisabled = isLoading || isCancelDisabled;

  return (
    <div className="mb-4 md:mb-6">
      <motion.button
        whileHover={isButtonDisabled ? {} : { scale: 1.05 }}
        whileTap={isButtonDisabled ? {} : { scale: 0.95 }}
        onClick={handleTicketClick}
        disabled={isButtonDisabled}
        className="rounded px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] transition-colors hover:bg-[#C11211] disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
      >
        {isLoading
          ? hasTicket
            ? TICKET_MESSAGES.CANCELLING
            : TICKET_MESSAGES.CREATING
          : hasTicket
            ? "Cancel Ticket"
            : "Get Ticket"}
      </motion.button>
      {isCancelDisabled && (
        <p className="mt-2 text-xs sm:text-sm text-yellow-400">
          {TICKET_MESSAGES.ERROR_LIVE_EVENT}
        </p>
      )}
      {message && !isCancelDisabled && (
        <p
          className={`mt-2 text-xs sm:text-sm ${
            message.includes("successfully") ? "text-green-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}
      {hasTicket && ticketId && <TicketQRCode ticketId={ticketId} />}
    </div>
  );
}
