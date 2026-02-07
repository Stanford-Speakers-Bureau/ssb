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
          <div className="mt-3 flex flex-wrap gap-3 items-center">
            <button
              onClick={handleNotifyClick}
              disabled={isLoadingNotify || isNotified}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/10"
            >
              {isLoadingNotify ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{TICKETING_NOTIFY_MESSAGES.SIGNING_UP}</span>
                </>
              ) : isNotified ? (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>You'll be notified</span>
                </>
              ) : (
                <span>Notify me when it opens</span>
              )}
            </button>
            {notifyMessage && (
              <p className="text-sm text-green-300">{notifyMessage}</p>
            )}
            {isNotified && !notifyMessage && (
              <p className="text-sm text-green-300">
                {TICKETING_NOTIFY_MESSAGES.ALREADY_SIGNED_UP}
              </p>
            )}
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
      {hasTicket && (<>
        {ticketName && (
          <p className="text-sm sm:text-base text-white font-medium mb-2">
            Ticket for <span className="font-semibold">{ticketName}</span>
          </p>
        )}
        <div className="inline-block">
          <p className="text-sm text-white font-semibold bg-red-600/80 px-4 py-2 rounded shadow mb-2">
            This ticket is not transferable. A matching student ID is required
            for entry.
          </p>
        </div>
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
          {/* {referralCode && !isVIP && (
            <div className="order-2 mt-2 md:mt-0 lg:order-2">
              <ReferralShare
                referralCode={referralCode}
                route={eventRoute}
                eventId={eventId}
                className="m-0"
                compact
              />
            </div>
          )} */}
        </div>
      </>)}
    </div>
  );
}
