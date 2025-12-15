"use client";

import { useState, useEffect } from "react";
import TicketButton from "./TicketButton";
import ReferralShare from "./ReferralShare";
import TicketQRCode from "./TicketQRCode";
import { generateReferralCode } from "../../lib/utils";

type TicketSectionProps = {
  eventId: string;
  initialHasTicket: boolean;
  initialTicketId: string | null;
  initialTicketType: string | null;
  userEmail: string | null;
  eventRoute: string;
  eventStartTime: string | null;
};

export default function TicketSection({
  eventId,
  initialHasTicket,
  initialTicketId,
  initialTicketType,
  userEmail,
  eventRoute,
  eventStartTime,
}: TicketSectionProps) {
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [ticketId, setTicketId] = useState<string | null>(initialTicketId);
  const [ticketType, setTicketType] = useState<string | null>(
    initialTicketType,
  );

  useEffect(() => {
    const handleTicketChange = async (event: Event) => {
      // When ticket changes, update state from event detail
      const customEvent = event as CustomEvent<{
        hasTicket: boolean;
        ticketId: string | null;
      }>;
      if (customEvent.detail) {
        setHasTicket(customEvent.detail.hasTicket);
        setTicketId(customEvent.detail.ticketId);

        // Fetch ticket type if we have a ticket ID
        if (customEvent.detail.ticketId) {
          try {
            const response = await fetch(`/api/ticket/user`);
            if (response.ok) {
              const data = await response.json();
              const ticket = data.tickets?.find(
                (t: { id: string; event_id: string }) =>
                  t.id === customEvent.detail.ticketId &&
                  t.event_id === eventId,
              );
              if (ticket) {
                setTicketType(ticket.type || null);
              }
            }
          } catch (error) {
            console.error("Error fetching ticket type:", error);
          }
        } else {
          setTicketType(null);
        }
      }
    };

    // Listen to ticket changes from TicketButton
    window.addEventListener("ticketChanged", handleTicketChange);

    return () => {
      window.removeEventListener("ticketChanged", handleTicketChange);
    };
  }, [eventId]);

  // Generate referral code from user email using standardized helper
  const referralCode = generateReferralCode(userEmail);

  return (
    <div className="event-ticket-section">
      <TicketButton
        eventId={eventId}
        initialHasTicket={hasTicket}
        initialTicketId={ticketId}
        eventStartTime={eventStartTime}
      />
      {hasTicket && (
        <div className="mt-3 flex flex-col gap-3 lg:grid lg:grid-cols-[auto_1fr] lg:items-start">
          {ticketId && (
            <div className="order-1 flex justify-center lg:order-1 lg:justify-self-start">
              <TicketQRCode
                ticketId={ticketId}
                size={190}
                compact
                ticketType={ticketType}
              />
            </div>
          )}
          {referralCode && (
            <div className="order-2 lg:order-2">
              <ReferralShare
                referralCode={referralCode}
                route={eventRoute}
                eventId={eventId}
                className="m-0"
                compact
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
