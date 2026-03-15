"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import TicketButton from "./TicketButton";
import TicketQRCode from "./TicketQRCode";
import Image from "next/image";
import { glassPanel, NoticeBanner } from "./ui";

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
  priorityText?: string | null;
  hideTicketingDate?: boolean;
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
  priorityText = null,
  hideTicketingDate = false,
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
  const [qrRevealed, setQrRevealed] = useState(false);

  const isWaitlistTicket = ticketType?.toUpperCase() === "WAITLIST";

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

  const hasValidTicketingOpensAt =
    ticketingOpensAt && !Number.isNaN(ticketingOpensAt.getTime());
  const showTicketPanel =
    hasTicket ||
    isTicketingOpen ||
    isSoldOut ||
    (!isTicketingOpen && (hasValidTicketingOpensAt || hideTicketingDate));

  return (
    <div className="event-ticket-section flex flex-col gap-5">
      {/* Ticket button (or ticketing-opens message when not yet open) */}
      {showTicketPanel && (
        hasTicket ? (
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
            priorityText={priorityText}
            hideTicketingDate={hideTicketingDate}
          />
        ) : (
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
              priorityText={priorityText}
              hideTicketingDate={hideTicketingDate}
            />
          </div>
        )
      )}

      {/* Ticket details when user has a ticket */}
      {hasTicket && (
        <>
          {ticketType?.toUpperCase() === "VIP" && (
            <NoticeBanner
              color="amber"
              icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9" /></svg>}
            >
              We&apos;ve reserved a seat for you in the front few rows. Please
              use the VIP entrance when you arrive at the venue.
            </NoticeBanner>
          )}
          {ticketId && (
            <div className={`${isWaitlistTicket ? "rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 shadow-lg" : glassPanel} p-5 sm:p-6 flex flex-col items-center relative overflow-hidden`}>

              {isWaitlistTicket && (
                <div className="mb-3 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/25">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Waitlist Ticket</p>
                </div>
              )}

              {ticketName && (
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-200 font-medium text-center mb-4">
                  Ticket for{" "}
                  <span className="text-zinc-900 dark:text-white font-semibold">{ticketName}</span>
                </p>
              )}

              <div className="relative">
                <TicketQRCode
                  ticketId={ticketId}
                  size={190}
                  compact
                  ticketType={ticketType}
                  attendeeName={ticketName}
                  eventStartTime={eventStartTime ?? doorsOpen}
                />

                {/* Waitlist ticket overlay — tap to reveal */}
                <AnimatePresence>
                  {isWaitlistTicket && !qrRevealed && (
                    <motion.button
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => setQrRevealed(true)}
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-lg cursor-pointer"
                    >
                      <svg className="w-10 h-10 text-zinc-400 dark:text-zinc-500 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
                      </svg>
                      <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Tap to reveal QR code</p>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

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

      {ticketType?.toUpperCase() !== "VIP" && hasTicket && (
        <NoticeBanner
          color="red"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>}
        >
          This ticket is not transferable. A photo ID will be required for entry.
        </NoticeBanner>
      )}

    </div>
  );
}
