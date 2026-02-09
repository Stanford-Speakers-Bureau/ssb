"use client";

import { useState, useEffect } from "react";
import TicketButton from "./TicketButton";
import TicketQRCode from "./TicketQRCode";
import Image from "next/image";

type TicketSectionProps = {
  eventId: string;
  initialHasTicket: boolean;
  initialTicketId: string | null;
  initialTicketType: string | null;
  initialTicketName?: string | null;
  userEmail: string | null;
  eventRoute: string;
  eventStartTime: string | null;
  doorsOpen: string | null;
  ticketingDate?: string | null;
  isSoldOut?: boolean;
  initialIsNotified?: boolean;
};

export default function TicketSection({
  eventId,
  initialHasTicket,
  initialTicketId,
  initialTicketType,
  initialTicketName = null,
  userEmail,
  eventRoute,
  eventStartTime,
  doorsOpen,
  ticketingDate = null,
  isSoldOut = false,
  initialIsNotified = false,
}: TicketSectionProps) {
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [ticketId, setTicketId] = useState<string | null>(initialTicketId);
  const [ticketType, setTicketType] = useState<string | null>(
    initialTicketType,
  );
  const [ticketName, setTicketName] = useState<string | null>(
    initialTicketName,
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
        ticketName?: string | null;
      }>;
      if (customEvent.detail) {
        setHasTicket(customEvent.detail.hasTicket);
        setTicketId(customEvent.detail.ticketId);
        setTicketName(customEvent.detail.ticketName ?? null);

        // Fetch ticket type (and name if not in event) if we have a ticket ID
        if (customEvent.detail.ticketId) {
          try {
            const response = await fetch(`/api/tickets`);
            if (response.ok) {
              const data = (await response.json()) as {
                tickets?: {
                  id: string;
                  event_id: string;
                  type?: string;
                  name?: string | null;
                }[];
              };
              const ticket = data.tickets?.find(
                (t: { id: string; event_id: string }) =>
                  t.id === customEvent.detail.ticketId &&
                  t.event_id === eventId,
              );
              if (ticket) {
                setTicketType(ticket.type || null);
                if (ticket.name != null) setTicketName(ticket.name);
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

  const ticketingOpensAt = ticketingDate ? new Date(ticketingDate) : null;
  const isTicketingOpen =
    !ticketingOpensAt || Number.isNaN(ticketingOpensAt.getTime())
      ? true
      : new Date() >= ticketingOpensAt;

  const glassPanel =
    "rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/70 shadow-lg";

  const hasValidTicketingOpensAt =
    ticketingOpensAt && !Number.isNaN(ticketingOpensAt.getTime());
  const showTicketPanel =
    hasTicket ||
    isTicketingOpen ||
    isSoldOut ||
    (!isTicketingOpen && hasValidTicketingOpensAt);

  return (
    <div className="event-ticket-section flex flex-col gap-5">
      {/* Ticket button (or ticketing-opens message when not yet open) */}
      {showTicketPanel && (
        <div className={glassPanel + " p-4 sm:p-5"}>
          <TicketButton
            eventId={eventId}
            initialHasTicket={hasTicket}
            eventStartTime={eventStartTime}
            doorsOpen={doorsOpen}
            isSoldOut={isSoldOut}
            isTicketingOpen={isTicketingOpen}
            ticketingOpensAt={ticketingDate}
            initialIsNotified={initialIsNotified}
          />
        </div>
      )}

      {/* Ticket details when user has a ticket */}
      {hasTicket && (
        <>
          {ticketType?.toUpperCase() === "VIP" && (
            <div className="rounded-xl bg-amber-50 dark:bg-zinc-900/50 border border-amber-200 dark:border-amber-400/25 shadow-lg p-4 sm:p-5">
              <div className="inline-flex items-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-400/25 px-3.5 py-2 w-full justify-center sm:justify-start">
                <svg
                  className="w-4 h-4 text-amber-400 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <polygon points="12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9" />
                </svg>
                <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-100 font-medium">
                  We&apos;ve reserved a seat for you in the front few rows. Please
                  use the VIP entrance when you arrive at the venue.
                </p>
              </div>
            </div>
          )}
          {ticketId && (
            <div className={`${glassPanel} p-5 sm:p-6 flex flex-col items-center`}>

              {ticketName && (
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-200 font-medium text-center mb-4">
                  Ticket for{" "}
                  <span className="text-zinc-900 dark:text-white font-semibold">{ticketName}</span>
                </p>
              )}
              <TicketQRCode
                ticketId={ticketId}
                size={190}
                compact
                ticketType={ticketType}
              />
              <div className="flex items-center justify-center gap-3 flex-wrap mt-4">
                <button
                  onClick={onAddToAppleWallet}
                  disabled={isLoadingAppleWallet}
                  className="inline-block border-none bg-transparent cursor-pointer p-0 relative disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.97]"
                >
                  <Image
                    src="/images/add-to-apple-wallet.svg"
                    alt="Add to Apple Wallet"
                    width={140}
                    height={44}
                    className={`h-11 w-auto ${isLoadingAppleWallet ? "opacity-50" : ""}`}
                  />
                  {isLoadingAppleWallet && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </button>
                <button
                  onClick={onAddToGoogleWallet}
                  disabled={isLoadingGoogleWallet}
                  className="inline-block border-none bg-transparent cursor-pointer p-0 relative disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.97]"
                >
                  <Image
                    src="/images/enUS_add_to_google_wallet_add-wallet-badge.png"
                    alt="Add to Google Wallet"
                    width={140}
                    height={44}
                    className={`h-11 w-auto ${isLoadingGoogleWallet ? "opacity-50" : ""}`}
                  />
                  {isLoadingGoogleWallet && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
