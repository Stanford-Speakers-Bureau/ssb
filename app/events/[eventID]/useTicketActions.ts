"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TICKETING_NOTIFY_MESSAGES } from "@/app/lib/constants";
import { isEventOver } from "@/app/lib/eventTime";
import { fireFullConfetti, fireSimpleConfetti } from "./confetti";

const REQUEST_TIMEOUT_MS = 12_000;
const WAITLIST_CACHE_PREFIX = "waitlist_status";
const PROCESSING_MESSAGE =
  "This is taking longer than usual. We are checking the result.";

class RequestTimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

type WaitlistStatusCache = {
  isOnWaitlist: boolean;
  position: number | null;
};

type TicketLookupResponse = {
  ticketId?: string;
  ticketName?: string | null;
  ticketType?: string | null;
  error?: string;
};

type WaitlistLookupResponse = {
  isOnWaitlist?: boolean;
  position?: number | null;
  total?: number;
  error?: string;
};

function getWaitlistCacheKey(eventId: string): string {
  return `${WAITLIST_CACHE_PREFIX}:${eventId}`;
}

function readWaitlistCache(eventId: string): WaitlistStatusCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(getWaitlistCacheKey(eventId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as WaitlistStatusCache;
    return {
      isOnWaitlist: !!parsed.isOnWaitlist,
      position:
        typeof parsed.position === "number" ? parsed.position : null,
    };
  } catch {
    return null;
  }
}

function writeWaitlistCache(eventId: string, value: WaitlistStatusCache): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      getWaitlistCacheKey(eventId),
      JSON.stringify(value),
    );
  } catch {
    // Ignore storage errors in private/incognito contexts.
  }
}

function clearWaitlistCache(eventId: string): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(getWaitlistCacheKey(eventId));
  } catch {
    // Ignore storage errors in private/incognito contexts.
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let didTimeout = false;
  const handleAbort = () => {
    controller.abort();
  };

  init.signal?.addEventListener("abort", handleAbort, { once: true });

  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new RequestTimeoutError();
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    init.signal?.removeEventListener("abort", handleAbort);
  }
}

async function safeJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export type TicketButtonProps = {
  eventId: string;
  initialHasTicket?: boolean;
  initialTicketId?: string | null;
  initialIsOnWaitlist?: boolean;
  initialWaitlistPosition?: number | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  doorsOpen?: string | null;
  isSoldOut?: boolean;
  isTicketingOpen?: boolean;
  ticketingOpensAt?: string | null;
  initialIsNotified?: boolean;
  isLoggedIn?: boolean;
  waitlistChance?: string | null;
  hideTicketingDate?: boolean;
  referralsEnabled?: boolean;
  initialIsScanned?: boolean;
  standbyMode?: boolean;
};

const REFERRAL_KEY = "referral";

export const TICKET_MESSAGES = {
  SUCCESS: "Ticket confirmed! Check your email in a moment.",
  DELETED: "Ticket cancelled successfully!",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in.",
  ERROR_ALREADY_HAS_TICKET: "You already have a ticket for this event.",
  ERROR_NO_TICKET: "You don't have a ticket for this event.",
  ERROR_CAPACITY_EXCEEDED: "This event is at full capacity.",
  ERROR_LIVE_EVENT: "Cannot cancel tickets while an event is live.",
  EVENT_OVER_WITH_TICKET: "This event is over. Thank you for attending!",
  EVENT_PASSED: "This event has passed.",
  CREATING: "Creating your ticket...",
  JOINING_WAITLIST: "Joining the waitlist...",
  CANCELLING: "Cancelling your ticket...",
} as const;

export default function useTicketActions({
  eventId,
  initialHasTicket = false,
  initialIsOnWaitlist = false,
  initialWaitlistPosition = null,
  eventStartTime = null,
  eventEndTime = null,
  isSoldOut = false,
  isTicketingOpen = true,
  ticketingOpensAt: ticketingOpensAtProp = null,
  initialIsNotified = false,
  isLoggedIn = false,
  waitlistChance = null,
  hideTicketingDate = false,
  referralsEnabled = false,
  initialIsScanned = false,
  standbyMode = false,
}: TicketButtonProps) {
  const [hasTicket, setHasTicket] = useState(initialHasTicket);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralWarning, setReferralWarning] = useState<string | null>(null);
  const autoTicketProcessed = useRef(false);
  const autoNotifyProcessed = useRef(false);
  const autoWaitlistProcessed = useRef(false);
  const autoStandbyTicketProcessed = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Waitlist states
  const initialWaitlistCache = readWaitlistCache(eventId);
  const hasSsrWaitlistState = isLoggedIn && isSoldOut && !initialHasTicket;
  const initialWaitlistState = hasSsrWaitlistState
    ? {
        isOnWaitlist: initialIsOnWaitlist,
        position: initialWaitlistPosition,
        isReady: initialIsOnWaitlist ? initialWaitlistPosition !== null : true,
      }
    : !isLoggedIn
      ? {
          isOnWaitlist: false,
          position: null,
          isReady: false,
        }
    : {
        isOnWaitlist: initialWaitlistCache?.isOnWaitlist ?? false,
        position: initialWaitlistCache?.position ?? null,
        isReady: !!initialWaitlistCache,
      };
  const [isOnWaitlist, setIsOnWaitlist] = useState(
    initialWaitlistState.isOnWaitlist,
  );
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(
    initialWaitlistState.position,
  );
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);
  const [isWaitlistStatusLoading, setIsWaitlistStatusLoading] = useState(false);
  const [isWaitlistPositionReady, setIsWaitlistPositionReady] = useState(
    initialWaitlistState.isReady,
  );

  // Ticket cancellation states
  const [showCancelTicketModal, setShowCancelTicketModal] = useState(false);

  // Notify when ticketing opens
  const [isNotified, setIsNotified] = useState(initialIsNotified);
  const [isLoadingNotify, setIsLoadingNotify] = useState(false);

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

    if (!isLoggedIn) {
      const currentPath = window.location.pathname;
      const redirectUrl = `${currentPath}?notify=true`;
      window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(redirectUrl)}`;
      return;
    }

    setIsLoadingNotify(true);
    let redirecting = false;
    try {
      const response = await fetchWithTimeout("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_id: eventId }),
      });
      if (response.status === 401) {
        redirecting = true;
        const currentPath = window.location.pathname;
        const redirectUrl = `${currentPath}?notify=true`;
        window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(redirectUrl)}`;
        return;
      }
      const data = (await safeJson<{
        alreadySignedUp?: boolean;
        error?: string;
      }>(response)) ?? {};
      if (response.ok) {
        setIsNotified(true);
        if (data.alreadySignedUp) {
          setMessage(TICKETING_NOTIFY_MESSAGES.ALREADY_SIGNED_UP);
        }
      } else {
        setMessage(data.error || TICKETING_NOTIFY_MESSAGES.ERROR_GENERIC);
      }
    } catch (error) {
      console.error("Error signing up for notifications:", error);
      setMessage(TICKETING_NOTIFY_MESSAGES.ERROR_GENERIC);
    } finally {
      if (!redirecting) setIsLoadingNotify(false);
    }
  }, [eventId, isLoadingNotify, isLoggedIn, isNotified]);

  const handleNotifyClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    void handleNotify();
  };

  // Check if event has started
  const hasEventStarted = eventStartTime
    ? new Date() >= new Date(eventStartTime)
    : false;

  const isEventLongOver = isEventOver({
    endTime: eventEndTime,
    startTime: eventStartTime,
  });

  // Standby mode is controlled by admin toggle
  const isStandbyMode = standbyMode;

  const resetWaitlistStateFromCache = useCallback(() => {
    if (!isLoggedIn) {
      clearWaitlistCache(eventId);
      setIsOnWaitlist(false);
      setWaitlistPosition(null);
      setIsWaitlistPositionReady(false);
      return;
    }

    if (isLoggedIn && isSoldOut && !initialHasTicket) {
      setIsOnWaitlist(initialIsOnWaitlist);
      setWaitlistPosition(initialWaitlistPosition);
      setIsWaitlistPositionReady(
        initialIsOnWaitlist ? initialWaitlistPosition !== null : true,
      );

      if (initialIsOnWaitlist) {
        writeWaitlistCache(eventId, {
          isOnWaitlist: true,
          position: initialWaitlistPosition,
        });
      } else {
        clearWaitlistCache(eventId);
      }
      return;
    }

    const cached = readWaitlistCache(eventId);
    setIsOnWaitlist(cached?.isOnWaitlist ?? false);
    setWaitlistPosition(cached?.position ?? null);
    setIsWaitlistPositionReady(!!cached);
  }, [
    eventId,
    initialHasTicket,
    initialIsOnWaitlist,
    initialWaitlistPosition,
    isLoggedIn,
    isSoldOut,
  ]);

  const reconcileTicketStatus = useCallback(
    async (expectedOutcome: "created" | "cancelled") => {
      try {
        const response = await fetchWithTimeout(
          `/api/tickets?eventId=${encodeURIComponent(eventId)}`,
          {
          method: "GET",
          },
        );
        const data =
          (await safeJson<{
            hasTicket?: boolean;
            ticketId?: string | null;
            ticketName?: string | null;
            ticketType?: string | null;
          }>(response)) ?? {};

        const hasEventTicket = response.ok && !!data.hasTicket;

        if (expectedOutcome === "created" && hasEventTicket) {
          setHasTicket(true);
          setMessage(TICKET_MESSAGES.SUCCESS);
          clearWaitlistCache(eventId);
          window.dispatchEvent(
            new CustomEvent("ticketChanged", {
              detail: {
                hasTicket: true,
                ticketId: data.ticketId ?? null,
                ticketName: data.ticketName ?? null,
                ticketType: data.ticketType ?? null,
              },
            }),
          );
          return true;
        }

        if (expectedOutcome === "cancelled" && !hasEventTicket) {
          setHasTicket(false);
          setMessage(TICKET_MESSAGES.DELETED);
          window.dispatchEvent(
            new CustomEvent("ticketChanged", {
              detail: {
                hasTicket: false,
                ticketId: null,
                ticketName: null,
                ticketType: null,
              },
            }),
          );
          return true;
        }
      } catch (error) {
        console.error("Error reconciling ticket status:", error);
      }

      return false;
    },
    [eventId],
  );

  const reconcileWaitlistStatus = useCallback(
    async (): Promise<WaitlistStatusCache | null> => {
      try {
        const response = await fetchWithTimeout(
          `/api/waitlist?eventId=${eventId}`,
          {
            method: "GET",
          },
        );
        const data = (await safeJson<WaitlistLookupResponse>(response)) ?? null;

        if (response.ok && data) {
          const nextIsOnWaitlist = !!data.isOnWaitlist;
          const nextPosition =
            typeof data.position === "number" ? data.position : null;

          setIsOnWaitlist(nextIsOnWaitlist);
          setWaitlistPosition(nextPosition);
          setIsWaitlistPositionReady(true);
          writeWaitlistCache(eventId, {
            isOnWaitlist: nextIsOnWaitlist,
            position: nextPosition,
          });
          return {
            isOnWaitlist: nextIsOnWaitlist,
            position: nextPosition,
          };
        }
      } catch (error) {
        console.error("Error reconciling waitlist status:", error);
      }

      return null;
    },
    [eventId],
  );

  useEffect(() => {
    // Clear message after 3 seconds
    if (message) {
      const lowered = message.toLowerCase();
      const autoClearMs =
        lowered.includes("processing") ||
        lowered.includes("checking") ||
        lowered.includes("waiting") ||
        lowered.includes("longer than usual")
          ? 10_000
          : 3_000;
      const timer = setTimeout(() => setMessage(null), autoClearMs);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    resetWaitlistStateFromCache();
    setIsWaitlistStatusLoading(false);
  }, [eventId, resetWaitlistStateFromCache]);

  // Check waitlist status when event is sold out
  const checkWaitlistStatus = useCallback(async () => {
    if (!isSoldOut || hasTicket) return;

    const cached = readWaitlistCache(eventId);
    if (cached && (!cached.isOnWaitlist || cached.position !== null)) {
      setIsOnWaitlist(cached.isOnWaitlist);
      setWaitlistPosition(cached.position);
      setIsWaitlistPositionReady(true);
      return;
    }

    try {
      setIsWaitlistStatusLoading(true);
      const response = await fetchWithTimeout(
        `/api/waitlist?eventId=${eventId}`,
      );
      if (response.ok) {
        const data = (await safeJson<WaitlistLookupResponse>(response)) ?? null;
        if (data) {
          const nextIsOnWaitlist = !!data.isOnWaitlist;
          const nextPosition =
            typeof data.position === "number" ? data.position : null;
          setIsOnWaitlist(nextIsOnWaitlist);
          setWaitlistPosition(nextPosition);
          setIsWaitlistPositionReady(true);
          writeWaitlistCache(eventId, {
            isOnWaitlist: nextIsOnWaitlist,
            position: nextPosition,
          });
        }
      } else {
        setIsWaitlistPositionReady(true);
      }
    } catch (error) {
      console.error("Error checking waitlist status:", error);
      setIsWaitlistPositionReady(true);
    } finally {
      setIsWaitlistStatusLoading(false);
    }
  }, [eventId, hasTicket, isSoldOut]);

  // Check waitlist status on mount if sold out
  useEffect(() => {
    if (
      isSoldOut &&
      !hasTicket &&
      (!isWaitlistPositionReady || (isOnWaitlist && waitlistPosition === null))
    ) {
      checkWaitlistStatus();
    }
  }, [
    checkWaitlistStatus,
    hasTicket,
    isOnWaitlist,
    isSoldOut,
    isWaitlistPositionReady,
    waitlistPosition,
  ]);

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
      const referralKey = REFERRAL_KEY;
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

      const response = await fetchWithTimeout("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 401) {
        // Not authenticated, redirect to Stanford sign-in
        redirecting = true;
        const currentPath = window.location.pathname;
        const redirectUrl = `${currentPath}?waitlist=true`;
        window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(redirectUrl)}`;
        return;
      }

      const data = (await safeJson<{
        position?: number;
        error?: string;
      }>(response)) ?? {};

      if (response.ok) {
        const nextPosition =
          typeof data.position === "number" ? data.position : null;
        setIsOnWaitlist(true);
        setWaitlistPosition(nextPosition);
        setIsWaitlistPositionReady(nextPosition !== null);
        writeWaitlistCache(eventId, {
          isOnWaitlist: true,
          position: nextPosition,
        });
        setMessage("Successfully joined the waitlist!");
        if (referral) {
          window.sessionStorage.removeItem(referralKey);
        }
        if (nextPosition === null) {
          void reconcileWaitlistStatus();
        }
      } else {
        const errorMessage = data.error || "Failed to join waitlist";
        setMessage(errorMessage);
      }
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        setMessage(PROCESSING_MESSAGE);
        const reconciled = await reconcileWaitlistStatus();
        if (reconciled?.isOnWaitlist) {
          setMessage("Successfully joined the waitlist!");
        } else {
          setMessage(
            "Your waitlist request may still be processing. Please try again in a moment.",
          );
        }
      } else {
        console.error("Error joining waitlist:", error);
        setMessage("Something went wrong. Please try again.");
      }
    } finally {
      if (!redirecting) setIsWaitlistLoading(false);
    }
  }, [eventId, referralCode, referralWarning, reconcileWaitlistStatus]);

  // Handle leaving waitlist
  const handleLeaveWaitlist = useCallback(async () => {
    setIsWaitlistLoading(true);
    setMessage(null);
    setShowCancelModal(false);

    try {
      const response = await fetchWithTimeout("/api/waitlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });

      const data = (await safeJson<{ error?: string }>(response)) ?? {};

      if (response.ok) {
        setIsOnWaitlist(false);
        setWaitlistPosition(null);
        setIsWaitlistPositionReady(true);
        writeWaitlistCache(eventId, {
          isOnWaitlist: false,
          position: null,
        });
        setMessage("Successfully left the waitlist");
      } else {
        const errorMessage = data.error || "Failed to leave waitlist";
        setMessage(errorMessage);
      }
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        setMessage(PROCESSING_MESSAGE);
        const reconciled = await reconcileWaitlistStatus();
        if (reconciled?.isOnWaitlist) {
          setMessage("You are still on the waitlist.");
        } else if (reconciled && !reconciled.isOnWaitlist) {
          setMessage("Successfully left the waitlist");
        } else {
          setMessage(
            "Your request to leave the waitlist may still be processing. Please refresh or try again in a moment.",
          );
        }
      } else {
        console.error("Error leaving waitlist:", error);
        setMessage("Something went wrong. Please try again.");
      }
    } finally {
      setIsWaitlistLoading(false);
    }
  }, [eventId, reconcileWaitlistStatus]);

  // Handle cancelling a ticket
  const handleCancelTicket = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    setShowCancelTicketModal(false);

    try {
      const response = await fetchWithTimeout("/api/tickets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });

      const data = (await safeJson<{ error?: string }>(response)) ?? {};

      if (response.ok) {
        setHasTicket(false);
        clearWaitlistCache(eventId);
        setMessage(TICKET_MESSAGES.DELETED);

        // Dispatch event to update ticket status
        window.dispatchEvent(
          new CustomEvent("ticketChanged", {
            detail: { hasTicket: false, ticketId: null, ticketName: null, ticketType: null },
          }),
        );
      } else {
        setMessage(data.error || TICKET_MESSAGES.ERROR_GENERIC);
      }
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        setMessage(PROCESSING_MESSAGE);
        const reconciled = await reconcileTicketStatus("cancelled");
        if (!reconciled) {
          setMessage(
            "Your cancellation may still be processing. Please refresh or try again in a moment.",
          );
        }
      } else {
        setMessage(TICKET_MESSAGES.ERROR_GENERIC);
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId, reconcileTicketStatus]);

  // Actual ticket creation/cancellation logic
  const processTicketRequest = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    let redirecting = false;

    try {
      // If there's a referral warning, don't proceed
      if (referralWarning) {
        setIsLoading(false);
        return;
      }

      const method = hasTicket ? "DELETE" : "POST";

      // Get referral from input or session storage if creating a ticket
      let referral: string | null = null;
      if (!hasTicket) {
        const referralKey = REFERRAL_KEY;
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

      const response = await fetchWithTimeout("/api/tickets", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 401) {
        // Not authenticated, redirect to Stanford sign-in with auto_ticket flag
        redirecting = true;
        const currentPath = window.location.pathname;
        const redirectUrl = `${currentPath}?ticket=true`;
        window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(redirectUrl)}`;
        return;
      }

      const data = (await safeJson<TicketLookupResponse>(response)) ?? {};

      if (response.ok) {
        if (hasTicket) {
          // Cancelling ticket
          setHasTicket(false);
          clearWaitlistCache(eventId);
          setMessage(TICKET_MESSAGES.DELETED);
        } else {
          // Creating ticket
          setHasTicket(true);
          clearWaitlistCache(eventId);
          setMessage(TICKET_MESSAGES.SUCCESS);
          fireFullConfetti();
          // Clear referral from session storage after successful ticket creation
          const referralKey = REFERRAL_KEY;
          window.sessionStorage.removeItem(referralKey);
        }
        // Dispatch event to update ticket count and ticket status
        window.dispatchEvent(
          new CustomEvent("ticketChanged", {
            detail: {
              hasTicket: !hasTicket,
              ticketId: !hasTicket ? data.ticketId || null : null,
              ticketName: !hasTicket ? (data.ticketName ?? null) : null,
              ticketType: !hasTicket ? (data.ticketType ?? null) : null,
            },
          }),
        );
      } else {
        setMessage(data.error || TICKET_MESSAGES.ERROR_GENERIC);
      }
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        setMessage(PROCESSING_MESSAGE);
        const reconciled = await reconcileTicketStatus(
          hasTicket ? "cancelled" : "created",
        );
        if (!reconciled) {
          setMessage(
            hasTicket
              ? "Your cancellation may still be processing. Please refresh in a moment."
              : "Your ticket request may still be processing. Please wait a moment before retrying.",
          );
        }
      } else {
        setMessage(TICKET_MESSAGES.ERROR_GENERIC);
      }
    } finally {
      if (!redirecting) setIsLoading(false);
    }
  }, [
    eventId,
    hasTicket,
    referralCode,
    referralWarning,
    reconcileTicketStatus,
  ]);

  // Standby ticket creation: issued when sold out and within 2 hours of event
  const processStandbyTicketRequest = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    let redirecting = false;

    try {
      const response = await fetchWithTimeout("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, type: "STANDBY" }),
      });

      if (response.status === 401) {
        redirecting = true;
        const currentPath = window.location.pathname;
        const redirectUrl = `${currentPath}?standby_ticket=true`;
        window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(redirectUrl)}`;
        return;
      }

      const data = (await safeJson<TicketLookupResponse>(response)) ?? {};

      if (response.ok) {
        setHasTicket(true);
        clearWaitlistCache(eventId);
        setMessage(TICKET_MESSAGES.SUCCESS);
        fireSimpleConfetti();
        // Dispatch event to update ticket status
        window.dispatchEvent(
          new CustomEvent("ticketChanged", {
            detail: {
              hasTicket: true,
              ticketId: data.ticketId || null,
              ticketName: data.ticketName ?? null,
              ticketType: data.ticketType ?? "STANDBY",
            },
          }),
        );
      } else {
        setMessage(data.error || TICKET_MESSAGES.ERROR_GENERIC);
      }
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        setMessage(PROCESSING_MESSAGE);
        const reconciled = await reconcileTicketStatus("created");
        if (!reconciled) {
          setMessage(
            "Your standby ticket may still be processing. Please wait a moment before retrying.",
          );
        }
      } else {
        setMessage(TICKET_MESSAGES.ERROR_GENERIC);
      }
    } finally {
      if (!redirecting) setIsLoading(false);
    }
  }, [eventId, reconcileTicketStatus]);

  // Validate referral code
  const validateReferralCode = useCallback(
    async (code: string) => {
      if (!code.trim()) {
        setReferralWarning(null);
        return;
      }

      try {
        const response = await fetchWithTimeout("/api/referrals", {
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

        const data = (await safeJson<{
          valid?: boolean;
          message?: string;
        }>(response)) ?? {};

        if (data.valid) {
          setReferralWarning(null);
        } else {
          setReferralWarning(data.message || "Invalid referral code");
        }
      } catch (error) {
        if (error instanceof RequestTimeoutError) {
          setReferralWarning(null);
          return;
        }

        console.error("Error validating referral code:", error);
        // Don't show error on validation failure, just clear warning
        setReferralWarning(null);
      }
    },
    [eventId],
  );

  // Track referral parameters from URL and store in session storage
  useEffect(() => {
    const referralKey = REFERRAL_KEY;
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
    if (url.searchParams.get("standby_ticket") === "true") {
      sessionStorage.setItem(`auto_standby_ticket_pending:${eventId}`, "1");
      url.searchParams.delete("standby_ticket");
      changed = true;
    }

    if (changed) {
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [eventId, isSoldOut, isTicketingOpen]);

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
        window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(currentUrl)}`;
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
    // Don't auto-create ticket if event is long over
    if (isEventLongOver) {
      sessionStorage.removeItem(autoTicketKey);
      setMessage(TICKET_MESSAGES.EVENT_PASSED);
      return;
    }

    autoTicketProcessed.current = true;
    sessionStorage.removeItem(autoTicketKey);
    void processTicketRequest();
  }, [eventId, processTicketRequest, hasTicket, isEventLongOver, isTicketingOpen]);

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

  // Auto-create standby ticket after redirect from authentication
  useEffect(() => {
    const autoStandbyTicketKey = `auto_standby_ticket_pending:${eventId}`;
    const pending = sessionStorage.getItem(autoStandbyTicketKey) === "1";
    if (!pending) return;
    if (autoStandbyTicketProcessed.current) return;
    if (hasTicket) {
      sessionStorage.removeItem(autoStandbyTicketKey);
      return;
    }

    autoStandbyTicketProcessed.current = true;
    sessionStorage.removeItem(autoStandbyTicketKey);
    void processStandbyTicketRequest();
  }, [eventId, processStandbyTicketRequest, hasTicket]);

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
    const referralKey = REFERRAL_KEY;
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

  const isSalesDisabled = isEventLongOver && !hasTicket;
  const isButtonDisabled =
    isLoading ||
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
    referralCode,
    referralWarning,
    isOnWaitlist,
    waitlistPosition,
    showCancelModal,
    setShowCancelModal,
    isWaitlistLoading,
    isWaitlistStatusLoading,
    isWaitlistPositionReady,
    showCancelTicketModal,
    setShowCancelTicketModal,
    isNotified,
    isLoadingNotify,

    // Props passed through
    initialIsScanned,
    isLoggedIn,
    isSoldOut,
    isTicketingOpen,
    waitlistChance,
    hideTicketingDate,
    referralsEnabled,

    // Computed
    hasEventStarted,
    isEventLongOver,
    isStandbyMode,
    ticketingOpensAt,
    formatTicketingOpensAt,
    isSalesDisabled,
    isButtonDisabled,
    showTicketingOpensOnly,

    // Handlers
    handleNotify,
    handleNotifyClick,
    processTicketRequest,
    processStandbyTicketRequest,
    handleJoinWaitlist,
    handleLeaveWaitlist,
    handleCancelTicket,
    handleReferralCodeChange,
  };
}
