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
  doorsOpen: string | null;
  ticketingDate?: string | null;
  isSoldOut?: boolean;
};

export default function TicketSection({
  eventId,
  initialHasTicket,
  initialTicketId,
  initialTicketType,
  userEmail,
  eventRoute,
  eventStartTime,
  doorsOpen,
  ticketingDate = null,
  isSoldOut = false,
}: TicketSectionProps) {
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [ticketId, setTicketId] = useState<string | null>(initialTicketId);
  const [ticketType, setTicketType] = useState<string | null>(
    initialTicketType,
  );

  const [isLoadingGoogleWallet, setIsLoadingGoogleWallet] = useState(false);
  const [isLoadingAppleWallet, setIsLoadingAppleWallet] = useState(false);

  const onAddToGoogleWallet = async () => {
    if (!ticketId || isLoadingGoogleWallet) return;
    setIsLoadingGoogleWallet(true);
    try {
      const res = await fetch("/api/tickets/google-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const data = (await res.json()) as { url?: string };

      if (data.url) {
        // This redirects the user to the Google Wallet save screen
        setIsLoadingGoogleWallet(false);
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Failed to load pass", err);
      setIsLoadingGoogleWallet(false);
    }
  };

  const onAddToAppleWallet = () => {
    if (!ticketId || isLoadingAppleWallet) return;
    setIsLoadingAppleWallet(true);
    window.location.href = `/api/tickets/apple-wallet?ticket_id=${ticketId}`;
    // Reset loading state after a short delay since the download doesn't navigate away
    setTimeout(() => {
      setIsLoadingAppleWallet(false);
    }, 2000);
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
              const data = (await response.json()) as {
                tickets?: { id: string; event_id: string; type?: string }[];
              };
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

  // Check if user has VIP ticket
  const isVIP = ticketType?.toLowerCase().trim() === "vip";

  const ticketingOpensAt = ticketingDate ? new Date(ticketingDate) : null;
  const isTicketingOpen =
    !ticketingOpensAt || Number.isNaN(ticketingOpensAt.getTime())
      ? true
      : new Date() >= ticketingOpensAt;

  const formatTicketingOpensAt = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  return (
    <div className="event-ticket-section">
      {!hasTicket && !isTicketingOpen && ticketingOpensAt && (
        <div className="mb-4 md:mb-6 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <p className="text-sm sm:text-base text-yellow-200">
            Ticketing isn’t open yet. It opens{" "}
            <span className="font-semibold">
              {formatTicketingOpensAt(ticketingOpensAt)}
            </span>
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={`/upcoming-speakers?notify=${encodeURIComponent(eventId)}`}
              className="inline-flex items-center justify-center rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 transition-colors"
            >
              Notify me when it opens
            </a>
          </div>
        </div>
      )}
      <TicketButton
        eventId={eventId}
        initialHasTicket={hasTicket}
        eventStartTime={eventStartTime}
        doorsOpen={doorsOpen}
        isSoldOut={isSoldOut}
        isTicketingOpen={isTicketingOpen}
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
            {ticketId && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={onAddToAppleWallet}
                  disabled={isLoadingAppleWallet}
                  className="inline-block border-none bg-transparent cursor-pointer p-0 relative disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Image
                    src="/images/add-to-apple-wallet.svg"
                    alt="Add to Apple Wallet"
                    width={157}
                    height={48}
                    className={`h-12 w-auto ${isLoadingAppleWallet ? "opacity-50" : ""}`}
                  />
                  {isLoadingAppleWallet && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shadow-lg" />
                    </div>
                  )}
                </button>
                <button
                  onClick={onAddToGoogleWallet}
                  disabled={isLoadingGoogleWallet}
                  className="inline-block border-none bg-transparent cursor-pointer p-0 relative disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Image
                    src="/images/enUS_add_to_google_wallet_add-wallet-badge.png"
                    alt="Add to Google Wallet"
                    width={157}
                    height={48}
                    className={`h-12 w-auto ${isLoadingGoogleWallet ? "opacity-50" : ""}`}
                  />
                  {isLoadingGoogleWallet && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shadow-lg" />
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
          {referralCode && !isVIP && (
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
