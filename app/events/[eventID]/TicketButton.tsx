"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    // Clear message after 3 seconds
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleTicketClick = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const url = hasTicket ? "/api/ticket" : "/api/ticket";
      const method = hasTicket ? "DELETE" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });

      if (response.status === 401) {
        // Not authenticated, redirect to Google sign-in
        const currentPath = window.location.pathname;
        window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(currentPath)}`;
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
        setMessage(data.error || TICKET_MESSAGES.ERROR_GENERIC);
      }
    } catch {
      setMessage(TICKET_MESSAGES.ERROR_GENERIC);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-4 md:mb-6">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleTicketClick}
        disabled={isLoading}
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
      {message && (
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
