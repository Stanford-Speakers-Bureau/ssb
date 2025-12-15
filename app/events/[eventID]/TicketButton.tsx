"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";

type TicketButtonProps = {
  eventId: string;
  initialHasTicket?: boolean;
  initialTicketId?: string | null;
  eventStartTime?: string | null;
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
  initialTicketId = null,
  eventStartTime = null,
}: TicketButtonProps) {
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [ticketId, setTicketId] = useState<string | null>(initialTicketId);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLiveEvent, setIsLiveEvent] = useState(false);
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralWarning, setReferralWarning] = useState<string | null>(null);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  const autoTicketProcessed = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if event has started
  // Note: eventStartTime is a UTC ISO string from the database, and Date objects
  // compare UTC timestamps internally, so this comparison is timezone-safe
  const hasEventStarted = eventStartTime
    ? new Date() >= new Date(eventStartTime)
    : false;

  useEffect(() => {
    // Clear message after 3 seconds
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const checkLiveEvent = useCallback(async () => {
    try {
      const response = await fetch("/api/events/live");
      const data = await response.json();
      setIsLiveEvent(data.liveEvent?.[0]?.id == eventId || false);
    } catch (error) {
      console.error("Error checking live event:", error);
      setIsLiveEvent(false);
    }
  }, [eventId]);

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

      const url = hasTicket ? "/api/ticket" : "/api/ticket";
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

      const data = await response.json();

      if (response.ok) {
        if (hasTicket) {
          // Cancelling ticket
          setHasTicket(false);
          setTicketId(null);
          setMessage(TICKET_MESSAGES.DELETED);
        } else {
          // Creating ticket
          setHasTicket(true);
          setTicketId(data.ticketId || null);
          setMessage(TICKET_MESSAGES.SUCCESS);
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
        const response = await fetch("/api/referrals/validate", {
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

        const data = await response.json();

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
          className="rounded px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] transition-colors hover:bg-[#C11211] disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {isLoading ? TICKET_MESSAGES.CREATING : "Get Ticket"}
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
    </div>
  );
}
