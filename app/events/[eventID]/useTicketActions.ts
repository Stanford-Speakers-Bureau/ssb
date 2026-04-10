"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TICKETING_NOTIFY_MESSAGES } from "@/app/lib/constants";
import { isEventOver } from "@/app/lib/eventTime";
import { ROLE_INELIGIBLE_CODE } from "@/app/lib/ticketingRoles";
import {
  fetchWithTimeout as sharedFetchWithTimeout,
  isFetchTimeoutError,
} from "@/app/lib/fetch";
import { fireFullConfetti, fireSimpleConfetti } from "./confetti";

const REQUEST_TIMEOUT_MS = 12_000;
const WAITLIST_CACHE_PREFIX = "waitlist_status";
const PROCESSING_MESSAGE =
  "This is taking longer than usual. We are checking the result.";
const FEE_WAIVER_INELIGIBLE_CODE = "fee_waiver_ineligible";
const DEFAULT_ASSU_URL = "https://assu.stanford.edu";
const DEFAULT_ASSU_FAQ_URL = "https://www.assu.stanford.edu/m/FAQ#question-85";
const DEFAULT_INELIGIBLE_MESSAGE =
  "Unfortunately, you are ineligible for online ticketing as your student activity fee for Speakers Bureau has been waived. We encourage you to show up to the venue early to join the standby line instead. Please contact ASSU for further details.";
const DEFAULT_INELIGIBLE_TITLE = "Speakers Bureau Student Activity Fee Waived";
const DEFAULT_ROLE_RESTRICTION_TITLE = "Ticketing Restricted";
const DEFAULT_ROLE_RESTRICTION_MESSAGE =
  "Online ticketing for this event is limited to specific Stanford affiliations. We encourage you to show up to the venue early to join the standby line instead.";

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

type FeeWaiverEligibilityResponse = {
  error?: string;
  code?: string;
  assuUrl?: string;
  faqUrl?: string;
};

type TicketingRoleEligibilityResponse = {
  error?: string;
  code?: string;
  allowedRoles?: string[];
};

type EmailCancellationContext = {
  attendeeName: string | null;
  cancelToken: string | null;
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

function getReferralStorageKey(eventId: string): string {
  return `referral:${eventId}`;
}

function readStoredReferralCode(eventId: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage.getItem(getReferralStorageKey(eventId));
  } catch {
    return null;
  }
}

function writeStoredReferralCode(eventId: string, referralCode: string): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      getReferralStorageKey(eventId),
      referralCode.trim(),
    );
  } catch {
    // Ignore storage errors in private/incognito contexts.
  }
}

function clearStoredReferralCode(eventId: string): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(getReferralStorageKey(eventId));
  } catch {
    // Ignore storage errors in private/incognito contexts.
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return sharedFetchWithTimeout(input, init, REQUEST_TIMEOUT_MS);
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
  initialTicketName?: string | null;
  initialEmailCancelAttendeeName?: string | null;
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
  allowCancelFlowAccess?: boolean;
};

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
  initialTicketName = null,
  initialEmailCancelAttendeeName = null,
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
  allowCancelFlowAccess = false,
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
  const [emailCancelContext, setEmailCancelContext] =
    useState<EmailCancellationContext | null>(null);
  const [showIneligibleModal, setShowIneligibleModal] = useState(false);
  const [ineligibleTitle, setIneligibleTitle] = useState(
    DEFAULT_INELIGIBLE_TITLE,
  );
  const [ineligibleMessage, setIneligibleMessage] = useState(
    DEFAULT_INELIGIBLE_MESSAGE,
  );
  const [showIneligibleLinks, setShowIneligibleLinks] = useState(true);
  const [ineligibleAssuUrl, setIneligibleAssuUrl] = useState(DEFAULT_ASSU_URL);
  const [ineligibleFaqUrl, setIneligibleFaqUrl] = useState(DEFAULT_ASSU_FAQ_URL);

  // Notify when ticketing opens
  const [isNotified, setIsNotified] = useState(initialIsNotified);
  const [isLoadingNotify, setIsLoadingNotify] = useState(false);

  const closeCancelTicketModal = useCallback(() => {
    setShowCancelTicketModal(false);

    if (emailCancelContext?.cancelToken) {
      setEmailCancelContext(null);
    }
  }, [emailCancelContext?.cancelToken]);

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

  const showIneligibleModalForResponse = useCallback(
    (
      data:
        | (FeeWaiverEligibilityResponse & TicketingRoleEligibilityResponse)
        | null
        | undefined,
    ) => {
      const isFeeWaiverResponse =
        data?.code === FEE_WAIVER_INELIGIBLE_CODE
        || (
          !data?.code &&
          (data?.error ?? "").toLowerCase().includes("please contact assu")
        );
      const isRoleRestrictionResponse =
        data?.code === ROLE_INELIGIBLE_CODE;

      if (isFeeWaiverResponse) {
        setMessage(null);
        setIneligibleTitle(DEFAULT_INELIGIBLE_TITLE);
        setIneligibleMessage(data?.error || DEFAULT_INELIGIBLE_MESSAGE);
        setShowIneligibleLinks(true);
        setIneligibleAssuUrl(data?.assuUrl || DEFAULT_ASSU_URL);
        setIneligibleFaqUrl(data?.faqUrl || DEFAULT_ASSU_FAQ_URL);
        setShowIneligibleModal(true);
        return true;
      }

      if (isRoleRestrictionResponse) {
        setMessage(null);
        setIneligibleTitle(DEFAULT_ROLE_RESTRICTION_TITLE);
        setIneligibleMessage(data?.error || DEFAULT_ROLE_RESTRICTION_MESSAGE);
        setShowIneligibleLinks(false);
        setShowIneligibleModal(true);
        return true;
      }

      return false;
    },
    [],
  );

  const redirectToAuth = useCallback(
    (intent: "notify" | "waitlist" | "ticket" | "standby_ticket") => {
      const redirectUrl = new URL(window.location.href);
      redirectUrl.searchParams.set(intent, "true");
      window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(
        redirectUrl.pathname + redirectUrl.search + redirectUrl.hash,
      )}`;
    },
    [],
  );

  const handleNotify = useCallback(async () => {
    if (isLoadingNotify || isNotified) return;

    if (!isLoggedIn) {
      redirectToAuth("notify");
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
        redirectToAuth("notify");
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
  }, [eventId, isLoadingNotify, isLoggedIn, isNotified, redirectToAuth]);

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
    if (!isLoggedIn) {
      redirectToAuth("waitlist");
      return;
    }

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
      if (referralsEnabled) {
        if (referralCode.trim()) {
          referral = referralCode.trim();
          writeStoredReferralCode(eventId, referral);
        } else {
          referral = readStoredReferralCode(eventId);
        }
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
        redirectToAuth("waitlist");
        return;
      }

      const data = (await safeJson<{
        position?: number;
        error?: string;
        code?: string;
        assuUrl?: string;
        faqUrl?: string;
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
          clearStoredReferralCode(eventId);
        }
        if (nextPosition === null) {
          void reconcileWaitlistStatus();
        }
      } else {
        const errorMessage = data.error || "Failed to join waitlist";
        if (showIneligibleModalForResponse(data)) {
          return;
        }
        setMessage(errorMessage);
      }
    } catch (error) {
      if (isFetchTimeoutError(error)) {
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
  }, [
    eventId,
    isLoggedIn,
    referralsEnabled,
    referralCode,
    referralWarning,
    reconcileWaitlistStatus,
    redirectToAuth,
    showIneligibleModalForResponse,
  ]);

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
      if (isFetchTimeoutError(error)) {
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
        body: JSON.stringify({
          event_id: eventId,
          ...(emailCancelContext?.cancelToken
            ? { cancel_token: emailCancelContext.cancelToken }
            : {}),
        }),
      });

      const data = (await safeJson<{ error?: string }>(response)) ?? {};

      if (response.ok) {
        setHasTicket(false);
        setEmailCancelContext(null);
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
      if (isFetchTimeoutError(error)) {
        setMessage(PROCESSING_MESSAGE);
        const canReconcile = !emailCancelContext?.cancelToken || isLoggedIn;
        const reconciled = canReconcile
          ? await reconcileTicketStatus("cancelled")
          : false;
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
  }, [emailCancelContext?.cancelToken, eventId, isLoggedIn, reconcileTicketStatus]);

  // Actual ticket creation/cancellation logic
  const processTicketRequest = useCallback(async () => {
    if (!isLoggedIn) {
      redirectToAuth("ticket");
      return;
    }

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
        if (referralsEnabled) {
          if (referralCode.trim()) {
            referral = referralCode.trim();
            writeStoredReferralCode(eventId, referral);
          } else {
            referral = readStoredReferralCode(eventId);
          }
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
        redirectToAuth("ticket");
        return;
      }

      const data =
        (await safeJson<
          TicketLookupResponse
          & FeeWaiverEligibilityResponse
          & TicketingRoleEligibilityResponse
        >(response)) ?? {};

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
          clearStoredReferralCode(eventId);
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
        if (showIneligibleModalForResponse(data)) {
          return;
        }
        setMessage(data.error || TICKET_MESSAGES.ERROR_GENERIC);
      }
    } catch (error) {
      if (isFetchTimeoutError(error)) {
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
    isLoggedIn,
    referralsEnabled,
    referralCode,
    referralWarning,
    reconcileTicketStatus,
    redirectToAuth,
    showIneligibleModalForResponse,
  ]);

  // Standby ticket creation: issued when sold out and within 2 hours of event
  const processStandbyTicketRequest = useCallback(async () => {
    if (!isLoggedIn) {
      redirectToAuth("standby_ticket");
      return;
    }

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
        redirectToAuth("standby_ticket");
        return;
      }

      const data =
        (await safeJson<
          TicketLookupResponse
          & FeeWaiverEligibilityResponse
          & TicketingRoleEligibilityResponse
        >(response)) ?? {};

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
        if (showIneligibleModalForResponse(data)) {
          return;
        }
        setMessage(data.error || TICKET_MESSAGES.ERROR_GENERIC);
      }
    } catch (error) {
      if (isFetchTimeoutError(error)) {
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
  }, [
    eventId,
    isLoggedIn,
    reconcileTicketStatus,
    redirectToAuth,
    showIneligibleModalForResponse,
  ]);

  // Validate referral code
  const validateReferralCode = useCallback(
    async (code: string) => {
      if (!code.trim()) {
        setReferralWarning(null);
        return;
      }

      if (!referralsEnabled) {
        setReferralWarning(null);
        return;
      }

      if (!isLoggedIn) {
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
        if (isFetchTimeoutError(error)) {
          setReferralWarning(null);
          return;
        }

        console.error("Error validating referral code:", error);
        // Don't show error on validation failure, just clear warning
        setReferralWarning(null);
      }
    },
    [eventId, isLoggedIn, referralsEnabled],
  );

  // Track referral parameters from URL and store in session storage
  useEffect(() => {
    const url = new URL(window.location.href);
    const urlReferralCode = url.searchParams.get("referral_code");

    if (!referralsEnabled) {
      clearStoredReferralCode(eventId);
      setReferralCode("");
      setReferralWarning(null);

      if (urlReferralCode) {
        url.searchParams.delete("referral_code");
        window.history.replaceState(
          {},
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
      }

      return;
    }

    // If we have referral parameters, store the referral code in session storage and input
    if (urlReferralCode) {
      writeStoredReferralCode(eventId, urlReferralCode);
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
      const storedReferral = readStoredReferralCode(eventId);
      if (storedReferral) {
        setReferralCode(storedReferral);
        void validateReferralCode(storedReferral);
      } else {
        setReferralCode("");
        setReferralWarning(null);
      }
    }
  }, [eventId, referralsEnabled, validateReferralCode]);

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
    const cancelTokenParam = url.searchParams.get("cancel_token");

    if (cancelTicketParam) {
      const normalizedCancelToken = cancelTokenParam?.trim() || null;

      if (!normalizedCancelToken && !isLoggedIn) {
        const currentUrl =
          window.location.pathname +
          window.location.search +
          window.location.hash;
        window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(currentUrl)}`;
        return;
      }

      // Clean up the URL immediately
      url.searchParams.delete("cancel_ticket");
      url.searchParams.delete("cancel_token");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );

      if (normalizedCancelToken) {
        if (!allowCancelFlowAccess) {
          setEmailCancelContext(null);
          return;
        }

        setEmailCancelContext({
          cancelToken: normalizedCancelToken,
          attendeeName: initialEmailCancelAttendeeName,
        });
        setShowCancelTicketModal(true);
        return;
      }

      setEmailCancelContext(null);
      if (hasTicket) {
        setShowCancelTicketModal(true);
      }
    }
  }, [
    allowCancelFlowAccess,
    hasTicket,
    initialEmailCancelAttendeeName,
    isLoggedIn,
  ]);

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
    if (referralsEnabled && value.trim()) {
      writeStoredReferralCode(eventId, value);
    } else {
      clearStoredReferralCode(eventId);
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
    closeCancelTicketModal,
    emailCancelAttendeeName: emailCancelContext?.attendeeName ?? null,
    showIneligibleModal,
    ineligibleTitle,
    ineligibleMessage,
    showIneligibleLinks,
    ineligibleAssuUrl,
    ineligibleFaqUrl,
    isNotified,
    isLoadingNotify,

    // Props passed through
    initialIsScanned,
    initialTicketName,
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
    closeIneligibleModal: () => setShowIneligibleModal(false),
  };
}
