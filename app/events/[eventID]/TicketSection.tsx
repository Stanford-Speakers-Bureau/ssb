"use client";

import { useState, useEffect } from "react";
import TicketButton from "./TicketButton";
import ReferralShare from "./ReferralShare";
import { generateReferralCode } from "../../lib/utils";

type TicketSectionProps = {
  eventId: string;
  initialHasTicket: boolean;
  initialTicketId: string | null;
  userEmail: string | null;
  eventRoute: string;
};

export default function TicketSection({
  eventId,
  initialHasTicket,
  initialTicketId,
  userEmail,
  eventRoute,
}: TicketSectionProps) {
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [ticketId, setTicketId] = useState<string | null>(initialTicketId);

  useEffect(() => {
    const handleTicketChange = (event: Event) => {
      // When ticket changes, update state from event detail
      const customEvent = event as CustomEvent<{
        hasTicket: boolean;
        ticketId: string | null;
      }>;
      if (customEvent.detail) {
        setHasTicket(customEvent.detail.hasTicket);
        setTicketId(customEvent.detail.ticketId);
      }
    };

    // Listen to ticket changes from TicketButton
    window.addEventListener("ticketChanged", handleTicketChange);

    return () => {
      window.removeEventListener("ticketChanged", handleTicketChange);
    };
  }, []);

  // Generate referral code from user email using standardized helper
  const referralCode = generateReferralCode(userEmail);

  return (
    <>
      <TicketButton
        eventId={eventId}
        initialHasTicket={hasTicket}
        initialTicketId={ticketId}
      />
      {hasTicket && referralCode && (
        <ReferralShare referralCode={referralCode} route={eventRoute} />
      )}
    </>
  );
}

