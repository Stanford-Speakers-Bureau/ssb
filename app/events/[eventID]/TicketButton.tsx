"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

type TicketButtonProps = {
  eventId: string;
  initialHasTicket?: boolean;
  initialTicketId?: string | null;
  eventStartTime?: string | null;
  doorsOpen?: string | null;
  isSoldOut?: boolean;
};

const TICKET_MESSAGES = {
  SUCCESS: "Ticket created successfully!",
  DELETED: "Ticket cancelled successfully!",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in.",
  ERROR_ALREADY_HAS_TICKET: "You already have a ticket for this event.",
  ERROR_NO_TICKET: "You don't have a ticket for this event.",
  ERROR_CAPACITY_EXCEEDED: "This event is at full capacity.",
  ERROR_LIVE_EVENT: "Cannot cancel tickets while an event is live.",
  ERROR_EVENT_STARTED:
    "Ticket sales have ended. This event has already started.",
  CREATING: "Creating ticket...",
  CANCELLING: "Cancelling ticket...",
} as const;

export default function TicketButton({
  eventId,
  initialHasTicket = false,
  eventStartTime = null,
  doorsOpen = null,
  isSoldOut = false,
}: TicketButtonProps) {
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLiveEvent, setIsLiveEvent] = useState(false);
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralWarning, setReferralWarning] = useState<string | null>(null);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  const autoTicketProcessed = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Waitlist states
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);
  const [isWaitlistStatusLoading, setIsWaitlistStatusLoading] = useState(false);
  const [isWaitlistPositionReady, setIsWaitlistPositionReady] = useState(false);

  // Ticket cancellation states
  const [showCancelTicketModal, setShowCancelTicketModal] = useState(false);

  // Check if event has started
  // Note: eventStartTime is a UTC ISO string from the database, and Date objects
  // compare UTC timestamps internally, so this comparison is timezone-safe
  const hasEventStarted = eventStartTime
    ? new Date() >= new Date(eventStartTime)
    : false;

  // Check if within 2-hour cutoff for waitlist (based on doors open time)
  const twoHoursBeforeDoorsOpen = doorsOpen
    ? new Date(doorsOpen).getTime() - 2 * 60 * 60 * 1000
    : null;
  const isWithinWaitlistCutoff = twoHoursBeforeDoorsOpen
    ? new Date().getTime() >= twoHoursBeforeDoorsOpen
    : false;

  useEffect(() => {
    // Clear message after 3 seconds
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Check waitlist status when event is sold out
  const checkWaitlistStatus = useCallback(async () => {
    if (!isSoldOut) return;

    try {
      setIsWaitlistStatusLoading(true);
      const response = await fetch(`/api/waitlist?eventId=${eventId}`);
      if (response.ok) {
        const data = (await response.json()) as {
          isOnWaitlist: boolean;
          position: number | null;
        };
        setIsOnWaitlist(data.isOnWaitlist);
        setWaitlistPosition(data.position);
        setIsWaitlistPositionReady(true);
      }
    } catch (error) {
      console.error("Error checking waitlist status:", error);
    } finally {
      setIsWaitlistStatusLoading(false);
    }
  }, [eventId, isSoldOut]);

  // Check waitlist status on mount if sold out
  useEffect(() => {
    if (isSoldOut && !hasTicket) {
      checkWaitlistStatus();
    }
  }, [isSoldOut, hasTicket, checkWaitlistStatus]);

  // Handle joining waitlist
  const handleJoinWaitlist = useCallback(async () => {
    setIsWaitlistLoading(true);
    setMessage(null);

    try {
      // If there's a referral warning, don't proceed
      if (referralWarning) {
        setIsWaitlistLoading(false);
        return;
      }

      // Get referral from input or session storage
      let referral: string | null = null;
      const referralKey = `referral`;
      if (referralCode.trim()) {
        referral = referralCode.trim();
        sessionStorage.setItem(referralKey, referral);
      } else {
        referral = sessionStorage.getItem(referralKey);
      }

      const requestBody: { event_id: string; referral?: string | null } = {
        event_id: eventId,
      };
      if (referral) {
        requestBody.referral = referral;
      }

      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 401) {
        // Not authenticated, redirect to Google sign-in
        const currentPath = window.location.pathname;
        const redirectUrl = `${currentPath}?waitlist=true`;
        window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(redirectUrl)}`;
        return;
      }

      const data = (await response.json()) as {
        position?: number;
        error?: string;
      };

      if (response.ok) {
        setIsOnWaitlist(true);
        setWaitlistPosition(null);
        setIsWaitlistPositionReady(false);
        await checkWaitlistStatus();
        setMessage("Successfully joined the waitlist!");
        // Clear referral from session storage
        sessionStorage.removeItem(referralKey);
      } else {
        const errorMessage = data.error || "Failed to join waitlist";
        setMessage(errorMessage);
      }
    } catch (error) {
      console.error("Error joining waitlist:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsWaitlistLoading(false);
    }
  }, [checkWaitlistStatus, eventId, referralCode, referralWarning]);

  // Handle leaving waitlist
  const handleLeaveWaitlist = useCallback(async () => {
    setIsWaitlistLoading(true);
    setMessage(null);
    setShowCancelModal(false);

    try {
      const response = await fetch("/api/waitlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });

      const data = (await response.json()) as { error?: string };

      if (response.ok) {
        setIsOnWaitlist(false);
        setWaitlistPosition(null);
        setIsWaitlistPositionReady(false);
        setMessage("Successfully left the waitlist");
      } else {
        const errorMessage = data.error || "Failed to leave waitlist";
        setMessage(errorMessage);
      }
    } catch (error) {
      console.error("Error leaving waitlist:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsWaitlistLoading(false);
    }
  }, [eventId]);

  const checkLiveEvent = useCallback(async () => {
    try {
      const response = await fetch("/api/events/live");
      const data = (await response.json()) as { liveEvent?: { id: string }[] };
      setIsLiveEvent(data.liveEvent?.[0]?.id == eventId || false);
    } catch (error) {
      console.error("Error checking live event:", error);
      setIsLiveEvent(false);
    }
  }, [eventId]);

  // Handle cancelling a ticket
  const handleCancelTicket = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    setShowCancelTicketModal(false);

    try {
      await checkLiveEvent();

      const response = await fetch("/api/tickets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });

      const data = (await response.json()) as {
        error?: string;
      };

      if (response.ok) {
        setHasTicket(false);
        setMessage(TICKET_MESSAGES.DELETED);

        // Dispatch event to update ticket status
        window.dispatchEvent(
          new CustomEvent("ticketChanged", {
            detail: { hasTicket: false, ticketId: null },
          }),
        );
      } else {
        setMessage(data.error || TICKET_MESSAGES.ERROR_GENERIC);
      }
    } catch (error) {
      setMessage(TICKET_MESSAGES.ERROR_GENERIC);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, checkLiveEvent]);

  const handleTicketClick = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      await checkLiveEvent();

      // If there's a referral warning, don't proceed
      if (referralWarning) {
        setIsLoading(false);
        return;
      }

      const url = hasTicket ? "/api/tickets" : "/api/tickets";
      const method = hasTicket ? "DELETE" : "POST";

      // Get referral from input or session storage if creating a ticket
      let referral: string | null = null;
      if (!hasTicket) {
        const referralKey = `referral`;
        // Use input value if provided, otherwise check session storage
        if (referralCode.trim()) {
          referral = referralCode.trim();
          sessionStorage.setItem(referralKey, referral);
        } else {
          referral = sessionStorage.getItem(referralKey);
        }
      }

      const requestBody: { event_id: string; referral?: string | null } = {
        event_id: eventId,
      };
      if (referral) {
        requestBody.referral = referral;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 401) {
        // Not authenticated, redirect to Google sign-in with auto_ticket flag
        const currentPath = window.location.pathname;
        const redirectUrl = `${currentPath}?ticket=true`;
        window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(redirectUrl)}`;
        return;
      }

      const data = (await response.json()) as {
        ticketId?: string;
        error?: string;
      };

      if (response.ok) {
        if (hasTicket) {
          // Cancelling ticket
          setHasTicket(false);
          setMessage(TICKET_MESSAGES.DELETED);
        } else {
          // Creating ticket
          setHasTicket(true);
          setMessage(TICKET_MESSAGES.SUCCESS);
          // Confetti on successful ticket creation - full screen coverage with delays
          void import("canvas-confetti").then(({ default: confetti }) => {
            // CSP may block blob: worker scripts; avoid workers so this works under strict CSP.
            const fire = confetti.create(undefined, {
              resize: true,
              useWorker: false,
            });

            // Center burst - massive (immediate)
            fire({
              particleCount: 300,
              spread: 180,
              startVelocity: 60,
              scalar: 1.3,
              origin: { y: 0.5 },
              zIndex: 9999,
            });

            // Top center - raining down (100ms delay)
            setTimeout(() => {
              fire({
                particleCount: 200,
                spread: 180,
                startVelocity: 50,
                scalar: 1.2,
                origin: { x: 0.5, y: 0 },
                zIndex: 9999,
              });
            }, 100);

            // Bottom center - shooting up (200ms delay)
            setTimeout(() => {
              fire({
                particleCount: 200,
                spread: 180,
                startVelocity: 50,
                scalar: 1.2,
                origin: { x: 0.5, y: 1 },
                zIndex: 9999,
              });
            }, 200);

            // Left side - full height coverage (300ms delay)
            setTimeout(() => {
              fire({
                particleCount: 150,
                angle: 90,
                spread: 180,
                startVelocity: 55,
                scalar: 1.1,
                origin: { x: 0, y: 0.5 },
                zIndex: 9999,
              });
            }, 300);

            // Right side - full height coverage (400ms delay)
            setTimeout(() => {
              fire({
                particleCount: 150,
                angle: 90,
                spread: 180,
                startVelocity: 55,
                scalar: 1.1,
                origin: { x: 1, y: 0.5 },
                zIndex: 9999,
              });
            }, 400);

            // Top-left corner (500ms delay)
            setTimeout(() => {
              fire({
                particleCount: 100,
                angle: 45,
                spread: 90,
                startVelocity: 45,
                scalar: 1.0,
                origin: { x: 0, y: 0 },
                zIndex: 9999,
              });
            }, 500);

            // Top-right corner (600ms delay)
            setTimeout(() => {
              fire({
                particleCount: 100,
                angle: 135,
                spread: 90,
                startVelocity: 45,
                scalar: 1.0,
                origin: { x: 1, y: 0 },
                zIndex: 9999,
              });
            }, 600);

            // Bottom-left corner (700ms delay)
            setTimeout(() => {
              fire({
                particleCount: 100,
                angle: 315,
                spread: 90,
                startVelocity: 45,
                scalar: 1.0,
                origin: { x: 0, y: 1 },
                zIndex: 9999,
              });
            }, 700);

            // Bottom-right corner (800ms delay)
            setTimeout(() => {
              fire({
                particleCount: 100,
                angle: 225,
                spread: 90,
                startVelocity: 45,
                scalar: 1.0,
                origin: { x: 1, y: 1 },
                zIndex: 9999,
              });
            }, 800);
          });
          // Clear referral from session storage after successful ticket creation
          const referralKey = `referral`;
          sessionStorage.removeItem(referralKey);
        }
        // Dispatch event to update ticket count and ticket status
        window.dispatchEvent(
          new CustomEvent("ticketChanged", {
            detail: {
              hasTicket: !hasTicket,
              ticketId: !hasTicket ? data.ticketId || null : null,
            },
          }),
        );
      } else {
        const errorMessage = data.error || TICKET_MESSAGES.ERROR_GENERIC;
        setMessage(errorMessage);
        // If it's a live event error, update the live event state
        if (errorMessage === TICKET_MESSAGES.ERROR_LIVE_EVENT) {
          setIsLiveEvent(true);
        }
        // If event has started, update state
        if (errorMessage === TICKET_MESSAGES.ERROR_EVENT_STARTED) {
          // State will be updated by hasEventStarted check
        }
      }
    } catch {
      setMessage(TICKET_MESSAGES.ERROR_GENERIC);
    } finally {
      setIsLoading(false);
    }
  }, [checkLiveEvent, eventId, hasTicket, referralCode, referralWarning]);

  // Validate referral code
  const validateReferralCode = useCallback(
    async (code: string) => {
      if (!code.trim()) {
        setReferralWarning(null);
        return;
      }

      setIsValidatingReferral(true);
      try {
        const response = await fetch("/api/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referral_code: code.trim(),
            event_id: eventId,
          }),
        });

        if (response.status === 401) {
          // Not authenticated, clear warning (will be handled on submit)
          setReferralWarning(null);
          return;
        }

        const data = (await response.json()) as {
          valid?: boolean;
          message?: string;
        };

        if (data.valid) {
          setReferralWarning(null);
        } else {
          setReferralWarning(data.message || "Invalid referral code");
        }
      } catch (error) {
        console.error("Error validating referral code:", error);
        // Don't show error on validation failure, just clear warning
        setReferralWarning(null);
      } finally {
        setIsValidatingReferral(false);
      }
    },
    [eventId],
  );

  // Track referral parameters from URL and store in session storage
  useEffect(() => {
    const referralKey = `referral`;
    const url = new URL(window.location.href);
    const urlReferralCode = url.searchParams.get("referral_code");

    // If we have referral parameters, store the referral code in session storage and input
    if (urlReferralCode) {
      sessionStorage.setItem(referralKey, urlReferralCode);
      setReferralCode(urlReferralCode);
      // Validate the referral code from URL
      void validateReferralCode(urlReferralCode);
      // Clean up the URL by removing the referral parameters
      url.searchParams.delete("referral_code");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    } else {
      // Check if there's already a referral code in session storage
      const storedReferral = sessionStorage.getItem(referralKey);
      if (storedReferral) {
        setReferralCode(storedReferral);
        void validateReferralCode(storedReferral);
      }
    }
  }, [eventId, validateReferralCode]);

  // Auto-create ticket after redirect from authentication.
  // Note: React 18 StrictMode (dev) mounts/unmounts effects twice, so we persist intent in sessionStorage
  // before removing `ticket=true` from the URL.
  useEffect(() => {
    const autoTicketKey = `auto_ticket_pending:${eventId}`;
    const url = new URL(window.location.href);
    const autoTicketParam = url.searchParams.get("ticket");

    if (autoTicketParam === "true") {
      sessionStorage.setItem(autoTicketKey, "1");
      url.searchParams.delete("ticket");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [eventId]);

  useEffect(() => {
    const autoTicketKey = `auto_ticket_pending:${eventId}`;
    const pending = sessionStorage.getItem(autoTicketKey) === "1";
    if (!pending) return;
    if (autoTicketProcessed.current) return;
    if (hasTicket) {
      sessionStorage.removeItem(autoTicketKey);
      return;
    }
    // Don't auto-create ticket if event has started
    if (hasEventStarted) {
      sessionStorage.removeItem(autoTicketKey);
      setMessage(TICKET_MESSAGES.ERROR_EVENT_STARTED);
      return;
    }

    autoTicketProcessed.current = true;
    sessionStorage.removeItem(autoTicketKey);
    void handleTicketClick();
  }, [eventId, handleTicketClick, hasTicket, hasEventStarted]);

  // Cleanup validation timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  const handleReferralCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setReferralCode(value);
    const referralKey = `referral`;
    if (value.trim()) {
      sessionStorage.setItem(referralKey, value.trim());
    } else {
      sessionStorage.removeItem(referralKey);
    }

    // Clear previous warning
    setReferralWarning(null);

    // Clear previous timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    // Debounce validation
    if (value.trim()) {
      validationTimeoutRef.current = setTimeout(() => {
        void validateReferralCode(value);
      }, 500);
    }
  };

  const isCancelDisabled = hasTicket && isLiveEvent;
  const isSalesDisabled = hasEventStarted && !hasTicket;
  const isButtonDisabled =
    isLoading ||
    isCancelDisabled ||
    isSalesDisabled ||
    (!!referralWarning && !hasTicket);

  // WAITLIST UI: If sold out and user doesn't have a ticket
  if (!hasTicket) {
    // Within 2-hour cutoff - show in-person message
    if (isWithinWaitlistCutoff) {
      return (
        <div className="mb-4 md:mb-6">
          <p className="text-sm sm:text-base text-yellow-400">
            This event is sold out. Please come to the venue in person for the
            in-person waitlist.
          </p>
        </div>
      );
    }

    // User is NOT on waitlist - show join button
    if (!isOnWaitlist) {
      return (
        <div className="mb-4 md:mb-6">
          {isWaitlistStatusLoading ? (
            <div className="mb-3">
              <div className="h-5 w-72 max-w-full rounded bg-white/10 animate-pulse mb-4" />
              <div className="h-4 w-40 rounded bg-white/10 animate-pulse mb-2" />
              <div className="h-11 w-full sm:w-64 rounded bg-white/10 animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-sm sm:text-base text-yellow-400 mb-3">
                This event is sold out, but you can join the waitlist!
              </p>

              {/* Referral Code Input */}
              <div className="mb-3">
                <label
                  htmlFor="waitlist-referral-input"
                  className="block text-sm sm:text-base text-white font-medium mb-2"
                >
                  Referral Code (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="waitlist-referral-input"
                    type="text"
                    value={referralCode}
                    onChange={handleReferralCodeChange}
                    placeholder="Enter referral code"
                    className={`w-full sm:w-auto min-w-[200px] rounded px-3 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-base text-white bg-white/10 backdrop-blur-sm border ${
                      referralWarning
                        ? "border-yellow-400 focus:ring-2 focus:ring-yellow-400"
                        : "border-white/20 focus:ring-2 focus:ring-red-500"
                    } focus:outline-none focus:border-transparent placeholder:text-zinc-400`}
                  />
                  {isValidatingReferral && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                  )}
                </div>
                {referralWarning && (
                  <p className="mt-2 text-xs sm:text-sm text-yellow-400">
                    {referralWarning}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Join Waitlist Button */}
          {isWaitlistStatusLoading ? (
            <div className="h-11 w-full sm:w-40 rounded bg-white/10 animate-pulse" />
          ) : (
            <motion.button
              whileHover={
                isWaitlistLoading || !!referralWarning ? {} : { scale: 1.05 }
              }
              whileTap={
                isWaitlistLoading || !!referralWarning ? {} : { scale: 0.95 }
              }
              onClick={handleJoinWaitlist}
              disabled={isWaitlistLoading || !!referralWarning}
              className="rounded px-5 py-2.5 sm:px-4 sm:py-2 text-base font-semibold text-white bg-[#A80D0C] transition-colors hover:bg-[#C11211] disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {isWaitlistLoading ? "Joining..." : "Join Waitlist"}
            </motion.button>
          )}

          {message && (
            <p
              className={`mt-2 text-xs sm:text-sm ${
                message.includes("Successfully") ||
                message.includes("successfully")
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      );
    }

    // User IS on waitlist - show position and leave button
    return (
      <div className="mb-4 md:mb-6">
        {isWaitlistPositionReady && waitlistPosition !== null ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-3 border border-white/20">
            <p className="text-sm sm:text-base text-white font-semibold mb-1">
              You're on the waitlist!
            </p>
            <p className="text-lg sm:text-xl text-white font-bold">
              Position #{waitlistPosition}
            </p>
            <p className="text-xs sm:text-sm text-zinc-300 mt-2">
              You will be emailed if we are able to find you a ticket. The
              online waitlist closes 2 hours before the event. After that,
              please come to the venue for an in-person waitlist that is first
              come first serve.
            </p>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-3 border border-white/20">
            <div className="h-5 w-48 rounded bg-white/10 animate-pulse mb-2" />
            <div className="h-7 w-36 rounded bg-white/10 animate-pulse mb-3" />
            <div className="h-3 w-full rounded bg-white/10 animate-pulse mb-2" />
            <div className="h-3 w-11/12 rounded bg-white/10 animate-pulse" />
          </div>
        )}

        {/* Leave Waitlist Button */}
        <motion.button
          whileHover={isWaitlistLoading ? {} : { scale: 1.05 }}
          whileTap={isWaitlistLoading ? {} : { scale: 0.95 }}
          onClick={() => setShowCancelModal(true)}
          disabled={isWaitlistLoading}
          className="rounded px-5 py-2.5 sm:px-4 sm:py-2 text-base font-semibold text-white bg-zinc-700 transition-colors hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {isWaitlistLoading ? "Processing..." : "Leave Waitlist"}
        </motion.button>

        {message && (
          <p
            className={`mt-2 text-xs sm:text-sm ${
              message.includes("Successfully") ||
              message.includes("successfully")
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {message}
          </p>
        )}

        {/* Cancellation Warning Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowCancelModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-white mb-4">
                  Leave Waitlist?
                </h3>
                <p className="text-zinc-300 mb-6 text-sm sm:text-base">
                  Are you sure you want to leave the waitlist? You can rejoin
                  immediately, but your position will be at the end of the
                  waitlist.
                </p>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 px-4 py-2 text-base font-semibold text-white bg-zinc-700 rounded-lg transition-colors hover:bg-zinc-600"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLeaveWaitlist}
                    className="flex-1 px-4 py-2 text-base font-semibold text-white bg-[#A80D0C] rounded-lg transition-colors hover:bg-[#C11211]"
                  >
                    Leave Waitlist
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="mb-4 md:mb-6">
      {!hasTicket && !isSalesDisabled && (
        <div className="mb-3">
          <label
            htmlFor="referral-code-input"
            className="block text-sm sm:text-base text-white font-medium mb-2"
          >
            Referral Code (Optional)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="referral-code-input"
              type="text"
              value={referralCode}
              onChange={handleReferralCodeChange}
              placeholder="Enter referral code"
              className={`w-full sm:w-auto min-w-[200px] rounded px-3 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-base text-white bg-white/10 backdrop-blur-sm border ${
                referralWarning
                  ? "border-yellow-400 focus:ring-2 focus:ring-yellow-400"
                  : "border-white/20 focus:ring-2 focus:ring-red-500"
              } focus:outline-none focus:border-transparent placeholder:text-zinc-400`}
            />
            {isValidatingReferral && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
            )}
          </div>
          {referralWarning && (
            <p className="mt-2 text-xs sm:text-sm text-yellow-400">
              {referralWarning}
            </p>
          )}
        </div>
      )}
      {!hasTicket && (
        <motion.button
          whileHover={isButtonDisabled ? {} : { scale: 1.05 }}
          whileTap={isButtonDisabled ? {} : { scale: 0.95 }}
          onClick={handleTicketClick}
          disabled={isButtonDisabled}
          className="rounded px-5 py-2.5 sm:px-4 sm:py-2 text-base font-semibold text-white bg-[#A80D0C] transition-colors hover:bg-[#C11211] disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {isLoading ? TICKET_MESSAGES.CREATING : "Get Ticket"}
        </motion.button>
      )}
      {hasTicket && !isCancelDisabled && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCancelTicketModal(true)}
          disabled={isLoading}
          className="rounded px-5 py-2.5 sm:px-4 sm:py-2 text-base font-semibold text-white bg-zinc-700 transition-colors hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {isLoading ? TICKET_MESSAGES.CANCELLING : "Cancel Ticket"}
        </motion.button>
      )}
      {isCancelDisabled && (
        <p className="mt-2 text-xs sm:text-sm text-yellow-400">
          {TICKET_MESSAGES.ERROR_LIVE_EVENT}
        </p>
      )}
      {isSalesDisabled && (
        <p className="mt-2 text-xs sm:text-sm text-yellow-400">
          {TICKET_MESSAGES.ERROR_EVENT_STARTED}
        </p>
      )}
      {message && !isCancelDisabled && !isSalesDisabled && (
        <p
          className={`mt-2 text-xs sm:text-sm ${
            message.includes("successfully") ? "text-green-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}

      {/* Cancel Ticket Modal */}
      <AnimatePresence>
        {showCancelTicketModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowCancelTicketModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4">
                Cancel Ticket?
              </h3>
              <p className="text-zinc-300 mb-6 text-sm sm:text-base">
                Are you sure you want to cancel your ticket? You may not be able
                to get your ticket back if you cancel.
              </p>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCancelTicketModal(false)}
                  className="flex-1 px-4 py-2 text-base font-semibold text-white bg-zinc-700 rounded-lg transition-colors hover:bg-zinc-600"
                >
                  Keep Ticket
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCancelTicket}
                  className="flex-1 px-4 py-2 text-base font-semibold text-white bg-[#A80D0C] rounded-lg transition-colors hover:bg-[#C11211]"
                >
                  Cancel Ticket
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
