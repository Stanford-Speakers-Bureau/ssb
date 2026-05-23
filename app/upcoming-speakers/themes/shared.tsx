"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { sanitizeSchema } from "@/app/lib/sanitize";
import { NOTIFY_MESSAGES } from "@/app/lib/constants";

/* -------------------------------------------------------------------------- */
/*  Shared scaffolding for the upcoming-speakers theme explorations.          */
/*  Themes vary presentation only; data flow + interaction logic live here.   */
/* -------------------------------------------------------------------------- */

/** A presentation-ready view model for one upcoming event, theme-agnostic. */
export type SpeakerCardVM = {
  id: string;
  mystery: boolean;
  name: string;
  /** Tagline / short markdown blurb. */
  header: string;
  dateText: string;
  doorsOpenText: string;
  eventTimeText: string;
  locationName: string;
  locationUrl: string;
  imageUrl: string;
  ctaHref: string;
  ctaText: string;
  /** Raw ISO reveal date, for the mystery countdown. */
  revealDateRaw: string | null;
  capacity: number | null;
  ticketsSold: number | null;
  reserved: number | null;
  isAlreadyNotified: boolean;
};

export type ThemeProps = {
  vms: SpeakerCardVM[];
  hasEvents: boolean;
  isLoggedIn: boolean;
};

export const MAILING_LIST_URL =
  "https://mailman.stanford.edu/mailman/listinfo/ssb-announce";
export const SUGGEST_URL = "/suggest";

export const EASE = [0.43, 0.13, 0.23, 0.96] as const;
export const SPRING = { type: "spring", stiffness: 320, damping: 22 } as const;
export const SOFT_SPRING = {
  type: "spring",
  stiffness: 220,
  damping: 20,
} as const;

/** Remaining tickets for an event, or null when capacity is unknown. */
export function ticketsLeft(vm: SpeakerCardVM): number | null {
  if (vm.capacity == null || vm.capacity <= 0) return null;
  const max = Math.max(0, vm.capacity - (vm.reserved ?? 0));
  return Math.max(0, max - (vm.ticketsSold ?? 0));
}

/* ---------------------------------- notify -------------------------------- */

export type NotifyStatus = "idle" | "loading" | "success" | "error";

export function useNotify(
  eventId: string,
  isLoggedIn: boolean,
  isAlreadyNotified: boolean,
) {
  const [status, setStatus] = useState<NotifyStatus>(
    isAlreadyNotified ? "success" : "idle",
  );
  const [message, setMessage] = useState(
    isAlreadyNotified ? NOTIFY_MESSAGES.ALREADY_SIGNED_UP : "",
  );

  useEffect(() => {
    if (isAlreadyNotified && status !== "success") {
      const t = setTimeout(() => {
        setStatus("success");
        setMessage(NOTIFY_MESSAGES.SUCCESS);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isAlreadyNotified, status]);

  const notify = useCallback(async () => {
    const loginUrl = `/api/auth/login?redirect_to=${encodeURIComponent(
      `/upcoming-speakers?notify=${eventId}`,
    )}`;
    if (!isLoggedIn) {
      window.location.href = loginUrl;
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_id: eventId }),
      });
      if (res.status === 401) {
        window.location.href = loginUrl;
        return;
      }
      const data = (await res.json()) as {
        alreadySignedUp?: boolean;
        error?: string;
      };
      if (res.ok) {
        setStatus("success");
        setMessage(
          data.alreadySignedUp
            ? NOTIFY_MESSAGES.ALREADY_SIGNED_UP
            : NOTIFY_MESSAGES.SUCCESS,
        );
      } else {
        setStatus("error");
        setMessage(data.error || NOTIFY_MESSAGES.ERROR_GENERIC);
      }
    } catch {
      setStatus("error");
      setMessage(NOTIFY_MESSAGES.ERROR_GENERIC);
    }
  }, [eventId, isLoggedIn]);

  return { status, message, notify };
}

/* -------------------------------- countdown ------------------------------- */

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} | null;

function calc(target: Date): CountdownParts {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function useCountdown(targetRaw: string | null): CountdownParts {
  const target = useMemo(() => {
    if (!targetRaw) return null;
    const d = new Date(targetRaw);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [targetRaw]);

  // Re-render once per second; the value itself is derived during render so we
  // never call setState synchronously inside the effect.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [target]);

  return target ? calc(target) : null;
}

export function countdownSegments(parts: NonNullable<CountdownParts>) {
  return [
    ...(parts.days > 0 ? [{ value: parts.days, label: "days" }] : []),
    { value: parts.hours, label: "hrs" },
    { value: parts.minutes, label: "min" },
    { value: parts.seconds, label: "sec" },
  ];
}

/* -------------------------------- markdown -------------------------------- */

/** Renders a short markdown blurb; the theme controls colour/size via className. */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/* ---------------------------------- icons --------------------------------- */
/* Stroke icons that inherit `currentColor` so each theme can tint them.       */

type IconProps = { className?: string };

export function CalendarIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

export function DoorIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 4h3a2 2 0 0 1 2 2v14" />
      <path d="M2 20h3" />
      <path d="M13 20h9" />
      <path d="M10 12v.01" />
      <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4.742-1.186A1 1 0 0 1 13 4.56z" />
    </svg>
  );
}

export function ClockIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function PinIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

export function TicketIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5v2" />
      <path d="M15 11v2" />
      <path d="M15 17v2" />
      <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function BellIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

export function SparkleIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l1.9 5.6a3 3 0 001.9 1.9L21.5 11l-5.6 1.9a3 3 0 00-1.9 1.9L12 20.4l-1.9-5.6a3 3 0 00-1.9-1.9L2.5 11l5.6-1.9a3 3 0 001.9-1.9L12 2z" />
    </svg>
  );
}

export function ArrowUpRightIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

export function Spinner({ className = "size-4" }: IconProps) {
  return (
    <span
      className={`${className} inline-block rounded-full border-2 border-current/30 border-t-current animate-spin`}
      aria-hidden="true"
    />
  );
}
