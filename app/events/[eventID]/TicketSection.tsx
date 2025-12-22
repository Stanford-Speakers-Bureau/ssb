"use client";

import { useState, useEffect } from "react";
import TicketButton from "./TicketButton";
import ReferralShare from "./ReferralShare";
import TicketQRCode from "./TicketQRCode";
import { generateReferralCode } from "@/app/lib/utils";
import Image from "next/image";

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
  const [isIOS] = useState(() => {
    if (typeof window === "undefined") return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  });
  const [isAndroidOrWeb] = useState(() => {
    if (typeof window === "undefined") return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(userAgent);
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    return isAndroid || !isIOSDevice;
  });

  const onAddToGoogleWallet = async () => {
    if (!ticketId) return;
    try {
      const res = await fetch("/api/tickets/google-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const data = await res.json();

      if (data.url) {
        // This redirects the user to the Google Wallet save screen
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Failed to load pass", err);
    }
  };

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
          <div className="flex flex-col items-center gap-3 lg:items-center">
            {ticketId && (
              <TicketQRCode
                ticketId={ticketId}
                size={190}
                compact
                ticketType={ticketType}
              />
            )}
            {isAndroidOrWeb && ticketId && (
              <button
                onClick={onAddToGoogleWallet}
                className="inline-block border-none bg-transparent cursor-pointer p-0"
              >
                <Image
                  src="/images/enUS_add_to_google_wallet_add-wallet-badge.png"
                  alt="Add to Google Wallet"
                  width={157}
                  height={48}
                  className="h-12 w-auto"
                />
              </button>
            )}
          </div>
          {isIOS && ticketId && (
            <div className="order-1 flex justify-center lg:justify-start">
              <a
                href={`/api/tickets/apple-wallet?ticket_id=${ticketId}`}
                className="inline-block"
              >
                <Image
                  src="/images/add-to-apple-wallet.svg"
                  alt="Add to Apple Wallet"
                  width={157}
                  height={48}
                  className="h-12 w-auto"
                />
              </a>
            </div>
          )}
          {referralCode && (
            <div className="order-2 mt-2 md:mt-0 lg:order-2">
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
