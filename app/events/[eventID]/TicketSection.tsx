"use client";

import { useState, useEffect } from "react";
import TicketButton from "./TicketButton";
import ReferralShare from "./ReferralShare";
import TicketQRCode from "./TicketQRCode";
import { generateReferralCode } from "@/app/lib/utils";
import Image from "next/image";
import { TICKETING_NOTIFY_MESSAGES } from "@/app/lib/constants";

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
  const [isNotified, setIsNotified] = useState(initialIsNotified);
  const [isLoadingNotify, setIsLoadingNotify] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);

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

  const handleNotifyClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isLoadingNotify || isNotified) return;

    setIsLoadingNotify(true);
    setNotifyMessage(null);

    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_id: eventId }),
      });

      if (response.status === 401) {
        // Not authenticated, redirect to Google sign-in
        setIsLoadingNotify(false);
        window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      const data = (await response.json()) as { error?: string };

      if (response.ok) {
        setIsNotified(true);
        setNotifyMessage(TICKETING_NOTIFY_MESSAGES.SUCCESS);
      } else if (response.status === 409) {
        setIsNotified(true);
        setNotifyMessage(TICKETING_NOTIFY_MESSAGES.ALREADY_SIGNED_UP);
      } else {
        setNotifyMessage(data.error || TICKETING_NOTIFY_MESSAGES.ERROR_GENERIC);
      }
    } catch (error) {
      console.error("Error signing up for notifications:", error);
      setNotifyMessage(TICKETING_NOTIFY_MESSAGES.ERROR_GENERIC);
    } finally {
      setIsLoadingNotify(false);
    }
  };

  const glassPanel =
    "rounded-xl bg-zinc-900/50 border border-zinc-800/70 shadow-lg";

  return (
    <div className="event-ticket-section flex flex-col gap-5">
      {/* Ticketing not open banner */}
      {!hasTicket && !isTicketingOpen && ticketingOpensAt && (
        <div
          className="rounded-xl bg-zinc-900/50 border border-yellow-500/25 shadow-lg p-4 sm:p-5"
        >
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] p-3.5 sm:p-4">
            <p className="text-sm sm:text-base text-yellow-200/90 leading-relaxed">
              Ticketing opens{" "}
              <span className="font-semibold text-yellow-100">
                {formatTicketingOpensAt(ticketingOpensAt)}
              </span>
            </p>
            <div className="mt-3 flex flex-col gap-3 items-center lg:flex-row lg:items-center">
              <button
                onClick={handleNotifyClick}
                disabled={isLoadingNotify || isNotified}
                className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/[0.1] hover:border-white/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingNotify ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{TICKETING_NOTIFY_MESSAGES.SIGNING_UP}</span>
                  </>
                ) : isNotified ? (
                  <>
                    <svg
                      className="w-4 h-4 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>You&apos;ll be notified</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                      />
                    </svg>
                    <span>Notify me when it opens</span>
                  </>
                )}
              </button>
              {notifyMessage && (
                <p className="text-sm text-green-400">{notifyMessage}</p>
              )}
              {isNotified && !notifyMessage && (
                <p className="text-sm text-green-400">
                  {TICKETING_NOTIFY_MESSAGES.ALREADY_SIGNED_UP}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ticket button */}
      <div className={glassPanel + " p-4 sm:p-5"}>
        <TicketButton
          eventId={eventId}
          initialHasTicket={hasTicket}
          eventStartTime={eventStartTime}
          doorsOpen={doorsOpen}
          isSoldOut={isSoldOut}
          isTicketingOpen={isTicketingOpen}
        />
      </div>

      {/* Ticket details when user has a ticket */}
      {hasTicket && (
        <>
          {ticketType?.toUpperCase() !== "VIP" && (
            <div className={`${glassPanel} p-4 sm:p-5`}>
              <div className="inline-flex items-center gap-2 rounded-lg bg-red-500/15 border border-red-500/20 px-3.5 py-2 w-full justify-center sm:justify-start">
                <svg
                  className="w-4 h-4 text-red-400 shrink-0"
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
                <p className="text-xs sm:text-sm text-red-200 font-medium">
                  For security reasons, this ticket is not transferable. A photo
                  ID is required for entry.
                </p>
              </div>
            </div>
          )}
          {ticketType?.toUpperCase() === "VIP" && (
            <div className="rounded-xl bg-zinc-900/50 border border-amber-400/25 shadow-lg p-4 sm:p-5">
              <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/15 border border-amber-400/25 px-3.5 py-2 w-full justify-center sm:justify-start">
                <svg
                  className="w-4 h-4 text-amber-400 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <polygon points="12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9" />
                </svg>
                <p className="text-xs sm:text-sm text-amber-100 font-medium">
                  We&apos;ve reserved a seat for you in the front few rows. Please
                  use the VIP entrance when you arrive at the venue.
                </p>
              </div>
            </div>
          )}
          {ticketId && (
            <div className={`${glassPanel} p-5 sm:p-6 flex flex-col items-center`}>

              {ticketName && (
                <p className="text-sm sm:text-base text-zinc-200 font-medium text-center mb-4">
                  Ticket for{" "}
                  <span className="text-white font-semibold">{ticketName}</span>
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
