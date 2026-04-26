"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import TicketButton from "./TicketButton";
import TicketQRCode from "./TicketQRCode";
import Image from "next/image";
import { isEventOver } from "@/app/lib/eventTime";
import { glassPanel, NoticeBanner } from "./ui";
import ReferralShare from "./ReferralShare";
import { generateReferralCode } from "@/app/lib/utils";
import CountdownTimer from "./CountdownTimer";

type TicketSectionProps = {
  eventId: string;
  initialHasTicket: boolean;
  initialTicketId: string | null;
  initialTicketType: string | null;
  initialTicketName?: string | null;
  initialIsOnWaitlist?: boolean;
  initialWaitlistPosition?: number | null;
  userEmail: string | null;
  eventRoute: string;
  eventStartTime: string | null;
  eventEndTime: string | null;
  doorsOpen: string | null;
  ticketingDate?: string | null;
  isSoldOut?: boolean;
  initialIsNotified?: boolean;
  waitlistChance?: string | null;
  hideTicketingDate?: boolean;
  referralsEnabled?: boolean;
  initialIsScanned?: boolean;
  standbyMode?: boolean;
  requireTicketAccess?: boolean;
  allowCancelFlowAccess?: boolean;
  initialEmailCancelAttendeeName?: string | null;
  eventName?: string | null;
};

type ViewerEventStateResponse = {
  authenticated?: boolean;
  userEmail?: string | null;
  ticketId?: string | null;
  ticketType?: string | null;
  ticketName?: string | null;
  ticketScanned?: boolean;
  isOnWaitlist?: boolean;
  waitlistPosition?: number | null;
  isNotified?: boolean;
};

export default function TicketSection({
  eventId,
  initialHasTicket,
  initialTicketId,
  initialTicketType,
  initialTicketName = null,
  initialIsOnWaitlist = false,
  initialWaitlistPosition = null,
  userEmail,
  eventRoute,
  eventStartTime,
  eventEndTime,
  doorsOpen,
  ticketingDate = null,
  isSoldOut = false,
  initialIsNotified = false,
  waitlistChance = null,
  hideTicketingDate = false,
  referralsEnabled = false,
  initialIsScanned = false,
  standbyMode = false,
  requireTicketAccess = false,
  allowCancelFlowAccess = false,
  initialEmailCancelAttendeeName = null,
  eventName = null,
}: TicketSectionProps) {
  const router = useRouter();
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [ticketId, setTicketId] = useState<string | null>(initialTicketId);
  const [ticketType, setTicketType] = useState<string | null>(
    initialTicketType,
  );
  const [ticketName, setTicketName] = useState<string | null>(
    initialTicketName,
  );
  const [viewerUserEmail, setViewerUserEmail] = useState<string | null>(userEmail);
  const [isOnWaitlist, setIsOnWaitlist] = useState(initialIsOnWaitlist);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(
    initialWaitlistPosition,
  );
  const [isNotified, setIsNotified] = useState(initialIsNotified);
  const [isScanned, setIsScanned] = useState(initialIsScanned);
  const [isViewerStateLoading, setIsViewerStateLoading] = useState(true);
  const [viewerStateError, setViewerStateError] = useState<string | null>(null);
  const [viewerStateRequestKey, setViewerStateRequestKey] = useState(0);

  const [isLoadingAppleWallet, setIsLoadingAppleWallet] = useState(false);
  const [qrRevealed, setQrRevealed] = useState(false);
  const [scannedRevealed, setScannedRevealed] = useState(false);

  const isStandbyTicket = ticketType?.toUpperCase() === "STANDBY";

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
    const handleTicketChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        hasTicket: boolean;
        ticketId: string | null;
        ticketName?: string | null;
        ticketType?: string | null;
      }>;
      if (customEvent.detail) {
        setHasTicket(customEvent.detail.hasTicket);
        setTicketId(customEvent.detail.ticketId);
        setTicketName(customEvent.detail.ticketName ?? null);
        setIsScanned(false);
        if (customEvent.detail.hasTicket) {
          setIsOnWaitlist(false);
          setWaitlistPosition(null);
        }
        if ("ticketType" in customEvent.detail) {
          setTicketType(customEvent.detail.ticketType ?? null);
        }
      }
    };

    window.addEventListener("ticketChanged", handleTicketChange);
    return () => {
      window.removeEventListener("ticketChanged", handleTicketChange);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadViewerState() {
      setIsViewerStateLoading(true);
      setViewerStateError(null);

      try {
        const response = await fetch(
          `/api/events/viewer-state?eventId=${encodeURIComponent(eventId)}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`Viewer state request failed (${response.status})`);
        }

        const data = (await response.json()) as ViewerEventStateResponse;

        if (ignore) return;

        setViewerUserEmail(data.userEmail ?? null);
        setHasTicket(!!data.ticketId);
        setTicketId(data.ticketId ?? null);
        setTicketType(data.ticketType ?? null);
        setTicketName(data.ticketName ?? null);
        setIsScanned(data.ticketScanned ?? false);
        setIsOnWaitlist(!!data.isOnWaitlist);
        setWaitlistPosition(
          typeof data.waitlistPosition === "number"
            ? data.waitlistPosition
            : null,
        );
        setIsNotified(!!data.isNotified);
      } catch (error) {
        console.error("Failed to load viewer event state:", error);
        if (!ignore) {
          setViewerStateError(
            "We couldn’t load your ticket status right now. Please try again.",
          );
        }
      } finally {
        if (!ignore) {
          setIsViewerStateLoading(false);
        }
      }
    }

    void loadViewerState();

    return () => {
      ignore = true;
    };
  }, [eventId, viewerStateRequestKey]);

  useEffect(() => {
    if (
      requireTicketAccess
      && !allowCancelFlowAccess
      && !isViewerStateLoading
      && !viewerStateError
      && !hasTicket
    ) {
      router.replace("/upcoming-speakers");
    }
  }, [
    hasTicket,
    allowCancelFlowAccess,
    isViewerStateLoading,
    requireTicketAccess,
    router,
    viewerStateError,
  ]);

  const ticketingOpensAt = ticketingDate ? new Date(ticketingDate) : null;

  const [isTicketingOpen, setIsTicketingOpen] = useState(() =>
    !ticketingOpensAt || Number.isNaN(ticketingOpensAt.getTime())
      ? true
      : new Date() >= ticketingOpensAt,
  );

  useEffect(() => {
    if (isTicketingOpen || !ticketingDate) return;
    const nextTicketingOpensAt = new Date(ticketingDate);
    if (Number.isNaN(nextTicketingOpensAt.getTime())) return;
    const ms = Math.max(nextTicketingOpensAt.getTime() - Date.now(), 0);
    const timer = setTimeout(() => setIsTicketingOpen(true), ms);
    return () => clearTimeout(timer);
  }, [isTicketingOpen, ticketingDate]);

  const isEventLongOver = isEventOver({
    endTime: eventEndTime,
    startTime: eventStartTime,
  });

  const doorsOpenDate = doorsOpen ? new Date(doorsOpen) : null;
  const [showDoorsCountdown, setShowDoorsCountdown] = useState(
    () => !!doorsOpenDate && doorsOpenDate > new Date() && !isEventLongOver,
  );

  const hasValidTicketingOpensAt =
    ticketingOpensAt && !Number.isNaN(ticketingOpensAt.getTime());
  const showTicketPanel =
    hasTicket ||
    isTicketingOpen ||
    isSoldOut ||
    (!isTicketingOpen && (hasValidTicketingOpensAt || hideTicketingDate));

  const ticketButtonProps = {
    eventId,
    initialHasTicket: hasTicket,
    initialIsOnWaitlist: isOnWaitlist,
    initialWaitlistPosition: waitlistPosition,
    initialTicketName: ticketName,
    eventStartTime,
    eventEndTime,
    doorsOpen,
    isSoldOut,
    isTicketingOpen,
    ticketingOpensAt: ticketingDate,
    initialIsNotified: isNotified,
    isLoggedIn: viewerUserEmail != null,
    waitlistChance,
    hideTicketingDate,
    referralsEnabled,
    initialIsScanned: isScanned,
    standbyMode,
    allowCancelFlowAccess,
    initialEmailCancelAttendeeName,
    ticketType,
    eventName,
  };

  if (
    isViewerStateLoading
    || (requireTicketAccess && !allowCancelFlowAccess && !hasTicket)
  ) {
    return (
      <div className="event-ticket-section flex flex-col gap-5">
        <div className={glassPanel + " p-5 sm:p-6"}>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-100" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">
                {requireTicketAccess
                  ? "Checking your ticket access..."
                  : "Loading your ticket status..."}
              </p>
              <p className="text-sm text-zinc-400">
                {requireTicketAccess
                  ? "If you already have a ticket, we'll bring it up automatically."
                  : "We're fetching your latest ticket, waitlist, and notification state."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewerStateError) {
    return (
      <div className="event-ticket-section flex flex-col gap-5">
        <div className={glassPanel + " p-5 sm:p-6"}>
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-medium text-white">
              {viewerStateError}
            </p>
            <button
              onClick={() => setViewerStateRequestKey((value) => value + 1)}
              className="rounded-xl bg-[#A80D0C] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#8E0B0A]"
            >
              Retry status check
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="event-ticket-section flex flex-col gap-5">
      {/* Ticket button (get ticket / waitlist / ticketing-opens when no ticket) */}
      {showTicketPanel && !hasTicket && (
        <div className={glassPanel + " p-4 sm:p-5"}>
          <TicketButton {...ticketButtonProps} />
        </div>
      )}

      {/* Ticket details when user has a ticket */}
      {hasTicket && (
        <>
          {isEventLongOver && (
            <div className={glassPanel + " p-4 sm:p-5 flex items-center justify-center"}>
              <p className="text-sm font-medium text-white text-center">
                This event is over. Thank you for attending!
              </p>
            </div>
          )}

          {showDoorsCountdown && doorsOpenDate && (
            <div className={glassPanel + " p-4 sm:p-5 flex items-center justify-center"}>
              <CountdownTimer
                targetDate={doorsOpenDate}
                label="Doors open in"
                onExpire={() => setShowDoorsCountdown(false)}
              />
            </div>
          )}

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
            <div className={`${isStandbyTicket ? "rounded-xl bg-zinc-900/50 border border-amber-500/30 shadow-lg" : glassPanel} p-5 sm:p-6 flex flex-col items-center relative overflow-hidden`}>
              {isStandbyTicket && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400/0 via-amber-400/40 to-amber-400/0" />
              )}

              {isStandbyTicket && (
                <div className="mb-3 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/25">
                  <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Standby Ticket</p>
                </div>
              )}

              {isStandbyTicket && waitlistChance?.toLowerCase() === "high" && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="mb-4 w-full px-3.5 py-2.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 relative overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/[0.07] to-emerald-400/0"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                  />
                  <div className="relative flex items-center gap-2.5">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-200">
                        High chance of getting in
                      </p>
                      <p className="text-xs text-emerald-400">
                        Based on past similar events
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {ticketName && (
                <p className="text-sm sm:text-base text-zinc-200 font-medium text-center mb-4">
                  Ticket for{" "}
                  <span className="text-white font-semibold">{ticketName}</span>
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

                {/* Standby ticket overlay — tap to reveal */}
                <AnimatePresence>
                  {isStandbyTicket && !qrRevealed && (
                    <motion.button
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => setQrRevealed(true)}
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900 rounded-lg cursor-pointer"
                    >
                      <svg className="w-10 h-10 text-zinc-500 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
                      </svg>
                      <p className="text-sm font-semibold text-zinc-400">Tap to reveal standby ticket</p>
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Scanned ticket overlay — tap to reveal */}
                <AnimatePresence>
                  {isScanned && !scannedRevealed && (
                    <motion.button
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => setScannedRevealed(true)}
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-950 rounded-lg cursor-pointer"
                    >
                      <svg className="w-10 h-10 text-emerald-400 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <p className="text-sm font-semibold text-emerald-300">Ticket scanned</p>
                      <p className="text-xs text-emerald-400/70 mt-1">Enjoy the event!</p>
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
              </div>

            </div>
          )}
        </>
      )}

      {/* Cancel ticket button — right after ticket card */}
      {hasTicket && <TicketButton {...ticketButtonProps} />}

      {hasTicket && referralsEnabled && viewerUserEmail && (() => {
        const code = generateReferralCode(viewerUserEmail);
        if (!code) return null;
        return (
          <div className={glassPanel + " overflow-hidden"}>
            <ReferralShare
              referralCode={code}
              route={eventRoute}
              eventId={eventId}
            />
          </div>
        );
      })()}

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
