"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { TICKETING_NOTIFY_MESSAGES } from "@/app/lib/constants";

type TicketButtonProps = {
  eventId: string;
  initialHasTicket?: boolean;
  initialTicketId?: string | null;
  eventStartTime?: string | null;
  doorsOpen?: string | null;
  isSoldOut?: boolean;
  isTicketingOpen?: boolean;
  ticketingOpensAt?: string | null;
  initialIsNotified?: boolean;
  isLoggedIn?: boolean;
  waitlistChance?: string | null;
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
  EVENT_OVER_WITH_TICKET:
    "This event is over. Thank you for attending!",
  EVENT_PASSED:
    "This event has passed.",
  CREATING: "Creating ticket...",
  CANCELLING: "Cancelling ticket...",
} as const;

export default function TicketButton({
  eventId,
  initialHasTicket = false,
  eventStartTime = null,
  doorsOpen = null,
  isSoldOut = false,
  isTicketingOpen = true,
  ticketingOpensAt: ticketingOpensAtProp = null,
  initialIsNotified = false,
  isLoggedIn = false,
  waitlistChance = null,
}: TicketButtonProps) {
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLiveEvent, setIsLiveEvent] = useState(false);
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralWarning, setReferralWarning] = useState<string | null>(null);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  const autoTicketProcessed = useRef(false);
  const autoNotifyProcessed = useRef(false);
  const autoWaitlistProcessed = useRef(false);
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

  // No bags policy modal states
  const [showNoBagsModal, setShowNoBagsModal] = useState(false);
  const [noBagsConfirmation, setNoBagsConfirmation] = useState("");

  // Notify when ticketing opens
  const [isNotified, setIsNotified] = useState(initialIsNotified);
  const [isLoadingNotify, setIsLoadingNotify] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);

  const ticketingOpensAt = ticketingOpensAtProp
    ? new Date(ticketingOpensAtProp)
    : null;
  const formatTicketingOpensAt = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);

  const handleNotify = useCallback(async () => {
    if (isLoadingNotify || isNotified) return;
    setIsLoadingNotify(true);
    setNotifyMessage(null);
    let redirecting = false;
    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_id: eventId }),
      });
      if (response.status === 401) {
        redirecting = true;
        const currentPath = window.location.pathname;
        const redirectUrl = `${currentPath}?notify=true`;
        window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(redirectUrl)}`;
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
      if (!redirecting) setIsLoadingNotify(false);
    }
  }, [eventId, isLoadingNotify, isNotified]);

  const handleNotifyClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    void handleNotify();
  };

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
    let redirecting = false;

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
        redirecting = true;
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
      if (!redirecting) setIsWaitlistLoading(false);
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
            detail: { hasTicket: false, ticketId: null, ticketName: null },
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

  // Actual ticket creation/cancellation logic
  const processTicketRequest = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    let redirecting = false;

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
        redirecting = true;
        const currentPath = window.location.pathname;
        const redirectUrl = `${currentPath}?ticket=true`;
        window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(redirectUrl)}`;
        return;
      }

      const data = (await response.json()) as {
        ticketId?: string;
        ticketName?: string | null;
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
              ticketName: !hasTicket ? data.ticketName ?? null : null,
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
        if (errorMessage === TICKET_MESSAGES.EVENT_PASSED) {
          // State will be updated by hasEventStarted check
        }
      }
    } catch {
      setMessage(TICKET_MESSAGES.ERROR_GENERIC);
    } finally {
      if (!redirecting) setIsLoading(false);
    }
  }, [checkLiveEvent, eventId, hasTicket, referralCode, referralWarning]);

  // Handle ticket click - show no bags modal first if creating ticket
  const handleTicketClick = useCallback(() => {
    if (!hasTicket) {
      // Show no bags policy modal before creating ticket
      setShowNoBagsModal(true);
      setNoBagsConfirmation("");
    } else {
      // For cancelling, proceed directly
      void processTicketRequest();
    }
  }, [hasTicket, processTicketRequest]);

  // Handle confirming no bags policy
  const handleConfirmNoBags = useCallback(() => {
    if (noBagsConfirmation.toLowerCase().trim() === "no bags") {
      setShowNoBagsModal(false);
      setNoBagsConfirmation("");
      void processTicketRequest();
    }
  }, [noBagsConfirmation, processTicketRequest]);

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

  // Auto-action after redirect from authentication.
  // Note: React 18 StrictMode (dev) mounts/unmounts effects twice, so we persist intent in sessionStorage
  // before removing query params from the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;

    if (url.searchParams.get("ticket") === "true") {
      sessionStorage.setItem(`auto_ticket_pending:${eventId}`, "1");
      url.searchParams.delete("ticket");
      changed = true;
    }
    if (url.searchParams.get("notify") === "true") {
      sessionStorage.setItem(`auto_notify_pending:${eventId}`, "1");
      url.searchParams.delete("notify");
      changed = true;
    }
    if (url.searchParams.get("waitlist") === "true") {
      sessionStorage.setItem(`auto_waitlist_pending:${eventId}`, "1");
      url.searchParams.delete("waitlist");
      changed = true;
    }

    if (changed) {
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [eventId]);

  // Handle cancel_ticket query parameter from email links
  useEffect(() => {
    const url = new URL(window.location.href);
    const cancelTicketParam = url.searchParams.get("cancel_ticket");

    if (cancelTicketParam) {
      // Clean up the URL immediately
      url.searchParams.delete("cancel_ticket");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );

      // If the user has a ticket, show the cancel confirmation modal
      if (hasTicket) {
        setShowCancelTicketModal(true);
      }
    }
  }, [hasTicket]);

  useEffect(() => {
    const autoTicketKey = `auto_ticket_pending:${eventId}`;
    const pending = sessionStorage.getItem(autoTicketKey) === "1";
    if (!pending) return;
    if (autoTicketProcessed.current) return;
    if (hasTicket) {
      sessionStorage.removeItem(autoTicketKey);
      return;
    }
    // Don't auto-create ticket if ticketing isn't open yet
    if (!isTicketingOpen) {
      sessionStorage.removeItem(autoTicketKey);
      return;
    }
    // Don't auto-create ticket if event has started
    if (hasEventStarted) {
      sessionStorage.removeItem(autoTicketKey);
      setMessage(TICKET_MESSAGES.EVENT_PASSED);
      return;
    }

    autoTicketProcessed.current = true;
    sessionStorage.removeItem(autoTicketKey);
    void handleTicketClick();
  }, [eventId, handleTicketClick, hasTicket, hasEventStarted, isTicketingOpen]);

  // Auto-notify after redirect from authentication (reuses handleNotify which handles 401)
  useEffect(() => {
    const autoNotifyKey = `auto_notify_pending:${eventId}`;
    const pending = sessionStorage.getItem(autoNotifyKey) === "1";
    if (!pending) return;
    if (autoNotifyProcessed.current) return;
    if (isNotified) {
      sessionStorage.removeItem(autoNotifyKey);
      return;
    }

    autoNotifyProcessed.current = true;
    sessionStorage.removeItem(autoNotifyKey);
    void handleNotify();
  }, [eventId, isNotified, handleNotify]);

  // Auto-join waitlist after redirect from authentication
  useEffect(() => {
    const autoWaitlistKey = `auto_waitlist_pending:${eventId}`;
    const pending = sessionStorage.getItem(autoWaitlistKey) === "1";
    if (!pending) return;
    if (autoWaitlistProcessed.current) return;
    if (isOnWaitlist || hasTicket) {
      sessionStorage.removeItem(autoWaitlistKey);
      return;
    }

    autoWaitlistProcessed.current = true;
    sessionStorage.removeItem(autoWaitlistKey);
    void handleJoinWaitlist();
  }, [eventId, handleJoinWaitlist, isOnWaitlist, hasTicket]);

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

  const isCancelDisabled =
    hasTicket && (isLiveEvent || hasEventStarted);
  const isSalesDisabled = hasEventStarted && !hasTicket;
  const isButtonDisabled =
    isLoading ||
    isCancelDisabled ||
    isSalesDisabled ||
    (!!referralWarning && !hasTicket);

  // Helper for message styling
  const messageClass = (msg: string) =>
    msg.includes("Successfully") || msg.includes("successfully")
      ? "text-green-400"
      : "text-red-400";

  // WAITLIST UI: If sold out and user doesn't have a ticket
  if (isSoldOut && !hasTicket) {
    // Within 2-hour cutoff - show in-person message
    if (isWithinWaitlistCutoff) {
      return (
        <div className="mb-5">
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 dark:border-yellow-500/20 dark:bg-yellow-500/[0.06] px-4 py-3">
            <p className="text-sm sm:text-base text-yellow-800 dark:text-yellow-200/90 leading-relaxed">
              This event is sold out. Please come to the venue in person for the
              in-person waitlist.
            </p>
          </div>
        </div>
      );
    }

    // User is NOT on waitlist - show join button
    if (!isOnWaitlist) {
      return (
        <div className="mb-5">
          {isWaitlistStatusLoading ? (
            <div className="mb-3">
              <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-900 p-6">
                <div className="h-4 w-20 rounded bg-white/10 animate-pulse mb-5" />
                <div className="h-7 w-48 rounded bg-white/10 animate-pulse mb-2" />
                <div className="h-4 w-64 max-w-full rounded bg-white/10 animate-pulse mb-6" />
                <div className="h-12 w-full rounded-xl bg-white/10 animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl p-[1.5px]">
              {/* Animated gradient border - rotating conic gradient behind the card */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <motion.div
                  className="absolute inset-[-50%]"
                  style={{
                    background: "conic-gradient(from 0deg, #A80D0C, #ff4444, #ff6b6b, #A80D0C, #ff4444, #A80D0C)",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
              </div>

              <div className="relative rounded-[calc(1rem-1.5px)] bg-zinc-950 p-5 sm:p-6">
                {/* Sold out label */}
                <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-4">
                  Sold out
                </p>

                {/* Hero copy */}
                <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-1.5">
                  Still want in?
                </h3>
                <p className="text-sm sm:text-[15px] text-zinc-400 leading-relaxed mb-6">
                  Spots open up when people cancel. Join the waitlist and we&apos;ll
                  automatically grab you a ticket the moment one is available.
                </p>

                {/* Value props row */}
                <div className="flex items-center gap-4 sm:gap-5 mb-6">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span className="text-xs sm:text-sm text-zinc-300">Instant delivery</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span className="text-xs sm:text-sm text-zinc-300">{waitlistChance || "High"} chance of getting a ticket</span>
                  </div>
                </div>

                {/* CTA Button */}
                <motion.button
                  whileHover={
                    isWaitlistLoading || !!referralWarning
                      ? {}
                      : { scale: 1.02 }
                  }
                  whileTap={
                    isWaitlistLoading || !!referralWarning
                      ? {}
                      : { scale: 0.98 }
                  }
                  onClick={handleJoinWaitlist}
                  disabled={isWaitlistLoading || !!referralWarning}
                  className="relative w-full rounded-xl px-6 py-3.5 sm:py-4 text-base font-bold text-zinc-950 bg-white transition-all hover:bg-zinc-100 hover:shadow-lg hover:shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isWaitlistLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                        Joining...
                      </>
                    ) : (
                      "Join Waitlist"
                    )}
                  </span>
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-zinc-200/40 to-transparent" />
                </motion.button>

                <p className="text-center text-[12px] text-zinc-400 mt-2.5 font-medium">
                  Based on historical cancelation data, you have a <strong>{waitlistChance?.toLowerCase() || "high"} chance</strong> of getting a ticket.
                </p>
              </div>
            </div>
          )}

          {message && (
            <p className={`mt-3 text-xs sm:text-sm ${messageClass(message)}`}>
              {message}
            </p>
          )}
        </div>
      );
    }

    // User IS on waitlist - show position and leave button
    return (
      <div className="mb-5">
        {isWaitlistPositionReady && waitlistPosition !== null ? (
          <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] overflow-hidden mb-4">
            {/* Top section */}
            <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
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
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={isWaitlistLoading}
                  className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
                >
                  Leave
                </button>
              </div>

              {/* Position hero */}
              <div className="mb-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-5xl sm:text-6xl font-black text-zinc-900 dark:text-white tracking-tighter tabular-nums leading-none">
                    #{waitlistPosition}
                  </span>
                  <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
                    in line
                  </span>
                </div>
              </div>

              <p className="text-[13px] sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {waitlistPosition === 1
                  ? "You\u2019re next \u2014 the first spot that opens is yours."
                  : waitlistPosition <= 3
                    ? `Almost there \u2014 only ${waitlistPosition - 1} ${waitlistPosition === 2 ? "person" : "people"} ahead of you.`
                    : "Sit tight \u2014 we\u2019ll email your ticket the moment a spot opens."}
              </p>
            </div>

            {/* Dashed divider with notches */}
            <div className="relative h-0 mx-0">
              <div className="absolute left-0 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-900" />
              <div className="absolute right-0 translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-900" />
              <div className="mx-5 border-t border-dashed border-zinc-200 dark:border-white/[0.08]" />
            </div>

            {/* Bottom section - chance + info */}
            <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4 space-y-3">
              {/* Chance of getting a ticket */}
              <div className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {waitlistChance || "High"} chance of getting a ticket
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Based on historical cancellation data
                  </p>
                </div>
              </div>

              {/* Compact info row */}
              <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  <span>Auto-assigned</span>
                </div>
                <span className="text-zinc-200 dark:text-zinc-700">&middot;</span>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <span>Emailed instantly</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] p-5 sm:p-6 mb-4">
            <div className="h-5 w-24 rounded-full bg-zinc-100 dark:bg-white/[0.06] animate-pulse mb-5" />
            <div className="h-14 w-20 rounded bg-zinc-100 dark:bg-white/[0.06] animate-pulse mb-3" />
            <div className="h-3.5 w-full rounded bg-zinc-100 dark:bg-white/[0.06] animate-pulse mb-2" />
            <div className="h-3.5 w-3/4 rounded bg-zinc-100 dark:bg-white/[0.06] animate-pulse" />
          </div>
        )}

        {message && (
          <p className={`mt-3 text-xs sm:text-sm ${messageClass(message)}`}>
            {message}
          </p>
        )}

        {/* Cancellation Warning Modal */}
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {showCancelModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
                  onClick={() => setShowCancelModal(false)}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                    className="bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white mb-3">
                      Leave Waitlist?
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-sm sm:text-base leading-relaxed">
                      You&apos;ll lose your spot. You can rejoin, but you&apos;ll be
                      placed at the end of the line.
                    </p>
                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCancelModal(false)}
                        className="flex-1 px-4 py-2.5 text-sm sm:text-base font-semibold text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/[0.06] rounded-lg transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:border-zinc-300 dark:hover:border-white/25"
                      >
                        Keep My Spot
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleLeaveWaitlist}
                        className="flex-1 px-4 py-2.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] rounded-lg transition-all hover:bg-[#C11211] hover:shadow-lg hover:shadow-red-900/20"
                      >
                        Leave
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}
      </div>
    );
  }

  // Ticketing not open yet: show "ticketing opens" + notify UI, or nothing (conditional render to satisfy Rules of Hooks)
  const showTicketingOpensOnly =
    !hasTicket && !isTicketingOpen && !isSoldOut &&
    ticketingOpensAt &&
    !Number.isNaN(ticketingOpensAt.getTime());

  return (
    <div>
      {!hasTicket && !isTicketingOpen && !isSoldOut ? (
        showTicketingOpensOnly ? (<>
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-500/20 dark:bg-yellow-500/[0.06] p-3.5 sm:p-4">
            <p className="text-sm sm:text-base text-yellow-800 dark:text-yellow-200/90 leading-relaxed">
              Ticketing opens{" "}
              <span className="font-semibold text-yellow-900 dark:text-yellow-100">
                {formatTicketingOpensAt(ticketingOpensAt!)}
              </span>
            </p>
            <div className="mt-3 flex flex-col gap-3 items-center lg:flex-row lg:items-center">
              <button
                onClick={handleNotifyClick}
                disabled={isLoadingNotify || isNotified}
                className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:border-zinc-300 dark:hover:border-white/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <span>RSVP: Notify me when it opens</span>
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
          {!isLoggedIn && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/20 px-3.5 py-2 w-full justify-center sm:justify-start">
              <svg
                className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0"
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
              <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-200 font-medium">
                This event is only open to Stanford affiliates.
              </p>
            </div>
          )}
        </>
        ) : null
      ) : (
        <>
          {/* {!hasTicket && !isSalesDisabled && (
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
              className={`w-full sm:w-auto min-w-[200px] rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-base text-white bg-white/[0.06] border ${referralWarning
                ? "border-yellow-400 focus:ring-2 focus:ring-yellow-400"
                : "border-white/15 focus:ring-2 focus:ring-red-500"
                } focus:outline-none focus:border-transparent placeholder:text-zinc-500`}
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
      )} */}

          {!hasTicket && (<>
            {!isLoggedIn && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/20 px-3.5 py-2 w-full justify-center sm:justify-start">
                <svg
                  className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0"
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
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-200 font-medium">
                  This event is only open to Stanford affiliates.
                </p>
              </div>
            )}
            <motion.button
              whileHover={isButtonDisabled ? {} : { scale: 1.02 }}
              whileTap={isButtonDisabled ? {} : { scale: 0.98 }}
              onClick={handleTicketClick}
              disabled={isButtonDisabled}
              className="rounded-lg px-6 py-3 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] transition-all hover:bg-[#C11211] hover:shadow-lg hover:shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed w-full active:scale-[0.98]"
            >
              {isLoading ? TICKET_MESSAGES.CREATING : "Get Ticket"}
            </motion.button>
          </>
          )}
          {hasTicket && !isCancelDisabled && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCancelTicketModal(true)}
              disabled={isLoading}
              className="rounded-lg border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/[0.06] px-6 py-3 text-sm sm:text-base font-semibold text-zinc-700 dark:text-zinc-200 transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/25 disabled:opacity-50 disabled:cursor-not-allowed w-full"
            >
              {isLoading ? TICKET_MESSAGES.CANCELLING : "Cancel Ticket"}
            </motion.button>
          )}
          {isCancelDisabled && (
            <div className="flex min-h-[3rem] items-center justify-center">
              <p className="text-xs sm:text-sm text-yellow-400/80 text-center">
                {hasEventStarted
                  ? TICKET_MESSAGES.EVENT_OVER_WITH_TICKET
                  : TICKET_MESSAGES.ERROR_LIVE_EVENT}
              </p>
            </div>
          )}
          {isSalesDisabled && (
            <div className="flex min-h-[3rem] items-center justify-center">
              <p className="text-xs sm:text-sm text-yellow-400/80 text-center">
                {TICKET_MESSAGES.EVENT_PASSED}
              </p>
            </div>
          )}
          {message && !isCancelDisabled && !isSalesDisabled && (
            <p
              className={`mt-3 text-xs sm:text-sm ${message.includes("successfully") ? "text-green-400" : "text-red-400"
                }`}
            >
              {message}
            </p>
          )}

          {/* Cancel Ticket Modal */}
          {typeof document !== "undefined" &&
            createPortal(
              <AnimatePresence>
                {showCancelTicketModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    onClick={() => setShowCancelTicketModal(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 10 }}
                      transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                      className="bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white mb-3">
                        Cancel Ticket?
                      </h3>
                      <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-sm sm:text-base leading-relaxed">
                        Are you sure you want to cancel your ticket? You may not be able
                        to get your ticket back if you cancel.
                      </p>
                      <div className="flex gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowCancelTicketModal(false)}
                          className="flex-1 px-4 py-2.5 text-sm sm:text-base font-semibold text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/[0.06] rounded-lg transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:border-zinc-300 dark:hover:border-white/25"
                        >
                          Keep Ticket
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCancelTicket}
                          className="flex-1 px-4 py-2.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] rounded-lg transition-all hover:bg-[#C11211] hover:shadow-lg hover:shadow-red-900/20"
                        >
                          Cancel Ticket
                        </motion.button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}

          {/* No Bags Policy Modal – portaled to body so it appears above date/time/location */}
          {typeof document !== "undefined" &&
            createPortal(
              <AnimatePresence>
                {showNoBagsModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    onClick={() => setShowNoBagsModal(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 10 }}
                      transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                      className="bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white mb-3">
                        No Bags Policy
                      </h3>
                      <p className="text-zinc-500 dark:text-zinc-400 mb-4 text-sm sm:text-base leading-relaxed">
                        This event has a strict no bags policy. <strong>You will be turned away
                          at the entrance with any form of a bag larger than a small clutch purse.</strong> (4.5” x 6.5”)
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-300 mb-5 text-sm sm:text-base font-medium">
                        Type &quot;no bags&quot; below to confirm you understand:
                      </p>
                      <input
                        type="text"
                        value={noBagsConfirmation}
                        onChange={(e) => setNoBagsConfirmation(e.target.value)}
                        placeholder="Type 'no bags' to confirm"
                        className="w-full rounded-lg px-4 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/15 focus:ring-2 focus:ring-red-500/50 focus:outline-none focus:border-red-500/30 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 mb-5 transition-colors"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && noBagsConfirmation.toLowerCase().trim() === "no bags") {
                            handleConfirmNoBags();
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setShowNoBagsModal(false);
                            setNoBagsConfirmation("");
                          }}
                          className="flex-1 px-4 py-2.5 text-sm sm:text-base font-semibold text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/[0.06] rounded-lg transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:border-zinc-300 dark:hover:border-white/25"
                        >
                          Cancel
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleConfirmNoBags}
                          disabled={noBagsConfirmation.toLowerCase().trim() !== "no bags"}
                          className="flex-1 px-4 py-2.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] rounded-lg transition-all hover:bg-[#C11211] hover:shadow-lg hover:shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Proceed
                        </motion.button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}
        </>
      )}
    </div>
  );
}
