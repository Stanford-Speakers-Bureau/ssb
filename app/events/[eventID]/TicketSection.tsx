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
  waitlistChance?: string | null;
  waitlistMode?: boolean;
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
  waitlistChance = null,
  waitlistMode = false,
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
            isLoggedIn={userEmail != null}
            waitlistChance={waitlistChance}
            waitlistMode={waitlistMode}
          />
        </div>
      )}

      {ticketType?.toUpperCase() !== "VIP" && ticketType?.toUpperCase() !== "WAITLIST" && hasTicket && (
        <div className={`${glassPanel} p-4 sm:p-5`}>
          <div className="inline-flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/20 px-3.5 py-2 w-full justify-center sm:justify-start">
            <svg
              className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-xs sm:text-sm text-red-700 dark:text-red-200 font-medium">
              For security reasons, this ticket is not transferable. A photo ID
              is required for entry.
            </p>
          </div>
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
          {ticketId && ticketType?.toUpperCase() === "WAITLIST" && (
            <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] overflow-hidden">
              {/* Top section */}
              <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Waitlisted
                    </span>
                  </span>
                </div>

                {ticketName && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-3">
                    Ticket for{" "}
                    <span className="text-zinc-900 dark:text-white font-semibold">{ticketName}</span>
                  </p>
                )}

                <div className="flex justify-center mb-3">
                  <TicketQRCode
                    ticketId={ticketId}
                    size={190}
                    compact
                    ticketType={ticketType}
                    attendeeName={ticketName}
                    eventStartTime={eventStartTime ?? doorsOpen}
                  />
                </div>

                <p className="text-[13px] sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  This ticket does <strong>not</strong> guarantee you a seat. You will only be admitted if space is available at the door.
                </p>
              </div>

              {/* Dashed divider with notches */}
              <div className="relative h-0 mx-0">
                <div className="absolute left-0 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-900" />
                <div className="absolute right-0 translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-900" />
                <div className="mx-5 border-t border-dashed border-zinc-200 dark:border-white/[0.08]" />
              </div>

              {/* Bottom section */}
              <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4 space-y-3">
                <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <span>Arrive early</span>
                  </div>
                  <span className="text-zinc-200 dark:text-zinc-700">&middot;</span>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                    <span>Check in with staff</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {ticketId && ticketType?.toUpperCase() !== "WAITLIST" && (
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
                attendeeName={ticketName}
                eventStartTime={eventStartTime ?? doorsOpen}
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
                {/* <button
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
                </button> */}
              </div>
            </div>
          )}
        </>
      )}


    </div>
  );
}
