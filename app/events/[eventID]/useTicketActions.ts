"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TICKETING_NOTIFY_MESSAGES } from "@/app/lib/constants";
import { fireFullConfetti, fireSimpleConfetti } from "./confetti";

export type TicketButtonProps = {
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
  priorityText?: string | null;
  hideTicketingDate?: boolean;
};

export const TICKET_MESSAGES = {
  SUCCESS: "Ticket created successfully!",
  DELETED: "Ticket cancelled successfully!",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in.",
  ERROR_ALREADY_HAS_TICKET: "You already have a ticket for this event.",
  ERROR_NO_TICKET: "You don't have a ticket for this event.",
  ERROR_CAPACITY_EXCEEDED: "This event is at full capacity.",
  ERROR_LIVE_EVENT: "Cannot cancel tickets while an event is live.",
  EVENT_OVER_WITH_TICKET: "This event is over. Thank you for attending!",
  EVENT_PASSED: "This event has passed.",
  CREATING: "Creating ticket...",
  CANCELLING: "Cancelling ticket...",
} as const;

export default function useTicketActions({
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
  priorityText = null,
  hideTicketingDate = false,
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
  const autoWaitlistTicketProcessed = useRef(false);
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
  const [noBagsIntent, setNoBagsIntent] = useState<
    "ticket" | "waitlist_ticket"
  >("ticket");

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
  const hasEventStarted = eventStartTime
    ? new Date() >= new Date(eventStartTime)
    : false;

  const isEventLongOver = eventStartTime
    ? new Date().getTime() >= new Date(eventStartTime).getTime() + 6 * 60 * 60 * 1000
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
          fireFullConfetti();
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
              ticketName: !hasTicket ? (data.ticketName ?? null) : null,
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
      }
    } catch {
      setMessage(TICKET_MESSAGES.ERROR_GENERIC);
    } finally {
      if (!redirecting) setIsLoading(false);
    }
  }, [checkLiveEvent, eventId, hasTicket, referralCode, referralWarning]);

  // Waitlist ticket creation: issued when sold out and within 2 hours of event
  const processWaitlistTicketRequest = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    let redirecting = false;

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, type: "WAITLIST" }),
      });

      if (response.status === 401) {
        redirecting = true;
        const currentPath = window.location.pathname;
        const redirectUrl = `${currentPath}?waitlist_ticket=true`;
        window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(redirectUrl)}`;
        return;
      }

      const data = (await response.json()) as {
        ticketId?: string;
        ticketName?: string | null;
        error?: string;
      };

      if (response.ok) {
        setHasTicket(true);
        setMessage(TICKET_MESSAGES.SUCCESS);
        fireSimpleConfetti();
        // Dispatch event to update ticket status
        window.dispatchEvent(
          new CustomEvent("ticketChanged", {
            detail: {
              hasTicket: true,
              ticketId: data.ticketId || null,
              ticketName: data.ticketName ?? null,
            },
          }),
        );
      } else {
        setMessage(data.error || TICKET_MESSAGES.ERROR_GENERIC);
      }
    } catch {
      setMessage(TICKET_MESSAGES.ERROR_GENERIC);
    } finally {
      if (!redirecting) setIsLoading(false);
    }
  }, [eventId]);

  // Handle ticket click - show no bags modal first if creating ticket
  const handleTicketClick = useCallback(() => {
    if (!hasTicket) {
      // Show no bags policy modal before creating ticket
      setNoBagsIntent("ticket");
      setShowNoBagsModal(true);
      setNoBagsConfirmation("");
    } else {
      // For cancelling, proceed directly
      void processTicketRequest();
    }
  }, [hasTicket, processTicketRequest]);

  // Handle waitlist ticket click - show no bags modal first
  const handleWaitlistTicketClick = useCallback(() => {
    setNoBagsIntent("waitlist_ticket");
    setShowNoBagsModal(true);
    setNoBagsConfirmation("");
  }, []);

  // Handle confirming no bags policy
  const handleConfirmNoBags = useCallback(() => {
    if (noBagsConfirmation.toLowerCase().trim() === "no bags") {
      setShowNoBagsModal(false);
      setNoBagsConfirmation("");
      if (noBagsIntent === "waitlist_ticket") {
        void processWaitlistTicketRequest();
      } else {
        void processTicketRequest();
      }
    }
  }, [
    noBagsConfirmation,
    noBagsIntent,
    processTicketRequest,
    processWaitlistTicketRequest,
  ]);

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
      // Only store notify intent if event is not sold out and ticketing isn't open yet
      if (!isSoldOut && !isTicketingOpen) {
        sessionStorage.setItem(`auto_notify_pending:${eventId}`, "1");
      }
      url.searchParams.delete("notify");
      changed = true;
    }
    if (url.searchParams.get("waitlist") === "true") {
      sessionStorage.setItem(`auto_waitlist_pending:${eventId}`, "1");
      url.searchParams.delete("waitlist");
      changed = true;
    }
    if (url.searchParams.get("waitlist_ticket") === "true") {
      sessionStorage.setItem(`auto_waitlist_ticket_pending:${eventId}`, "1");
      url.searchParams.delete("waitlist_ticket");
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
      // If not logged in, redirect to login and come back with the cancel param
      if (!isLoggedIn) {
        const currentUrl =
          window.location.pathname +
          window.location.search +
          window.location.hash;
        window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(currentUrl)}`;
        return;
      }

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
  }, [hasTicket, isLoggedIn]);

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
  // Skip if event is sold out (user should join waitlist instead) or ticketing is already open
  useEffect(() => {
    const autoNotifyKey = `auto_notify_pending:${eventId}`;
    const pending = sessionStorage.getItem(autoNotifyKey) === "1";
    if (!pending) return;
    if (autoNotifyProcessed.current) return;
    if (isNotified || isSoldOut || isTicketingOpen) {
      sessionStorage.removeItem(autoNotifyKey);
      return;
    }

    autoNotifyProcessed.current = true;
    sessionStorage.removeItem(autoNotifyKey);
    void handleNotify();
  }, [eventId, isNotified, isSoldOut, isTicketingOpen, handleNotify]);

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

  // Auto-create waitlist ticket after redirect from authentication
  useEffect(() => {
    const autoWaitlistTicketKey = `auto_waitlist_ticket_pending:${eventId}`;
    const pending = sessionStorage.getItem(autoWaitlistTicketKey) === "1";
    if (!pending) return;
    if (autoWaitlistTicketProcessed.current) return;
    if (hasTicket) {
      sessionStorage.removeItem(autoWaitlistTicketKey);
      return;
    }

    autoWaitlistTicketProcessed.current = true;
    sessionStorage.removeItem(autoWaitlistTicketKey);
    void handleWaitlistTicketClick();
  }, [eventId, handleWaitlistTicketClick, hasTicket]);

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

  const isCancelDisabled = hasTicket && (isLiveEvent || hasEventStarted);
  const isSalesDisabled = hasEventStarted && !hasTicket;
  const isButtonDisabled =
    isLoading ||
    isCancelDisabled ||
    isSalesDisabled ||
    (!!referralWarning && !hasTicket);

  // Ticketing not open yet: show "ticketing opens" + notify UI
  const showTicketingOpensOnly =
    !hasTicket &&
    !isTicketingOpen &&
    !isSoldOut &&
    (hideTicketingDate || (ticketingOpensAt && !Number.isNaN(ticketingOpensAt.getTime())));

  return {
    // State
    hasTicket,
    isLoading,
    message,
    isLiveEvent,
    referralCode,
    referralWarning,
    isValidatingReferral,
    isOnWaitlist,
    waitlistPosition,
    showCancelModal,
    setShowCancelModal,
    isWaitlistLoading,
    isWaitlistStatusLoading,
    isWaitlistPositionReady,
    showCancelTicketModal,
    setShowCancelTicketModal,
    showNoBagsModal,
    setShowNoBagsModal,
    noBagsConfirmation,
    setNoBagsConfirmation,
    isNotified,
    isLoadingNotify,
    notifyMessage,

    // Props passed through
    isLoggedIn,
    isSoldOut,
    isTicketingOpen,
    waitlistChance,
    priorityText,
    hideTicketingDate,

    // Computed
    hasEventStarted,
    isEventLongOver,
    isWithinWaitlistCutoff,
    ticketingOpensAt,
    formatTicketingOpensAt,
    isCancelDisabled,
    isSalesDisabled,
    isButtonDisabled,
    showTicketingOpensOnly,

    // Handlers
    handleNotify,
    handleNotifyClick,
    handleTicketClick,
    handleJoinWaitlist,
    handleLeaveWaitlist,
    handleCancelTicket,
    handleWaitlistTicketClick,
    handleConfirmNoBags,
    handleReferralCodeChange,
  };
}
