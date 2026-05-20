"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ─── Types ───

type Phase = "mystery" | "pre-ticketing" | "ticketing-open";

export type EventPopupProps = {
  eventId: string;
  text: string;
  href: string;
  target: string | null;
  prefaceLabel: string;
  phase: Phase;
  imageUrl: string | null;
  speakerName: string | null;
  isLoggedIn: boolean;
  isNotified: boolean;
};

// ─── Countdown helpers ───

function calcTimeLeft(targetMs: number | null) {
  if (targetMs == null) return null;
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

// ─── Animated digit (vertical flip, matches BannerBar TimeUnit) ───

function FlipDigit({ value }: { value: string }) {
  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 32, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute font-mono font-bold text-2xl sm:text-3xl tabular-nums text-white"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ─── Countdown Clock ───

function PopupCountdown({
  targetMs,
  label,
}: {
  targetMs: number | null;
  label: string;
}) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(targetMs));

  useEffect(() => {
    if (targetMs == null) return;
    const tick = () => setTimeLeft(calcTimeLeft(targetMs));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (!timeLeft) return null;

  const segments = [
    ...(timeLeft.days > 0 ? [{ value: timeLeft.days, unit: "days" }] : []),
    { value: timeLeft.hours, unit: "hrs" },
    { value: timeLeft.minutes, unit: "min" },
    { value: timeLeft.seconds, unit: "sec" },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
        {label}
      </p>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {segments.map((seg, i) => (
          <div key={seg.unit} className="flex items-center gap-1.5 sm:gap-2">
            {i > 0 && (
              <span className="text-lg font-bold text-zinc-600 -mt-4">
                :
              </span>
            )}
            <div className="flex flex-col items-center">
              <div className="rounded-lg bg-white/[0.06] border border-white/10 w-[3rem] sm:w-[3.5rem] h-[2.75rem] sm:h-[3.25rem] flex items-center justify-center">
                <FlipDigit value={String(seg.value).padStart(2, "0")} />
              </div>
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 mt-1 font-medium">
                {seg.unit}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Confetti ───

async function fireConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#A80D0C", "#C11211", "#ffffff", "#f59e0b", "#ef4444"],
      zIndex: 9999,
    });
  } catch {
    // confetti is optional
  }
}

// ─── localStorage helpers ───

const DISMISS_PREFIX = "ssb-popup-dismissed:";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function isDismissed(eventId: string): boolean {
  try {
    const stored = localStorage.getItem(DISMISS_PREFIX + eventId);
    if (!stored) return false;
    const dismissedAt = new Date(stored).getTime();
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function setDismissed(eventId: string) {
  try {
    localStorage.setItem(DISMISS_PREFIX + eventId, new Date().toISOString());
  } catch {
    // localStorage unavailable
  }
}

// ─── Suppressed routes ───

const SUPPRESSED_PREFIXES = ["/events/", "/upcoming-speakers", "/scan", "/suggest/"];

function isSuppressedRoute(pathname: string): boolean {
  return SUPPRESSED_PREFIXES.some((p) => pathname.startsWith(p));
}

// ─── Auto-action URL helper ───
// Appends an auto-action query param (e.g. ?notify=true / ?ticket=true) that the
// destination page (event page via useTicketActions, or this popup for mystery)
// reads on arrival to complete the action without a second click.
function withAutoAction(url: string, action: "notify" | "ticket"): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${action}=true`;
}

// ─── Main Component ───

export default function EventPopup({
  eventId,
  text,
  href,
  target,
  prefaceLabel,
  phase,
  imageUrl,
  speakerName,
  isLoggedIn,
  isNotified: initialIsNotified,
}: EventPopupProps) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const confettiFiredRef = useRef(false);
  const autoNotifyFiredRef = useRef(false);

  const targetMs = useMemo(() => {
    if (!target) return null;
    const t = new Date(target).getTime();
    return Number.isNaN(t) ? null : t;
  }, [target]);

  // Show popup after delay, checking localStorage and route
  useEffect(() => {
    if (isSuppressedRoute(pathname)) return;
    if (isDismissed(eventId)) return;

    const timer = setTimeout(() => {
      setVisible(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [eventId, pathname]);

  // Fire confetti for ticketing-open phase
  useEffect(() => {
    if (visible && phase === "ticketing-open" && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      const id = setTimeout(fireConfetti, 400);
      return () => clearTimeout(id);
    }
  }, [visible, phase]);

  // Body scroll lock
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  const dismiss = useCallback(() => {
    setDismissed(eventId);
    setVisible(false);
  }, [eventId]);

  const isMystery = phase === "mystery";

  // ─── Action handlers ───
  //
  // Pattern: clicking a CTA should land the user on a page with the action done,
  // not leave them staring at the same popup.
  //
  //  • Mystery phase has no public event page yet, so we keep them on the popup:
  //    sign them up inline (logged in), or send them through login with a notify
  //    flag so the popup auto-completes the signup on return (no second click).
  //  • Pre-ticketing: navigate to the event page with ?notify=true; the page
  //    signs them up on arrival. Logged-out users get a login hop first.
  //  • Ticketing open: navigate to the event page (no auto-action) so they go
  //    through the "Get Ticket" → "no bags" confirmation there; we never skip it.

  const redirectToLogin = useCallback((destination: string) => {
    window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(destination)}`;
  }, []);

  const handleNotify = useCallback(async () => {
    if (isMystery) {
      // Stay on the popup. Logged-out users complete the signup after login via
      // the ?notify=true flag picked up by the auto-complete effect below.
      if (!isLoggedIn) {
        const here =
          window.location.pathname +
          window.location.search +
          window.location.hash;
        redirectToLogin(withAutoAction(here, "notify"));
        return;
      }

      setNotifyStatus("loading");
      try {
        const res = await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speaker_id: eventId }),
        });
        if (res.status === 401) {
          const here =
            window.location.pathname +
            window.location.search +
            window.location.hash;
          redirectToLogin(withAutoAction(here, "notify"));
          return;
        }
        setNotifyStatus(res.ok ? "success" : "error");
      } catch {
        setNotifyStatus("error");
      }
      return;
    }

    // Pre-ticketing: send them to the event page, which signs them up on arrival.
    setNotifyStatus("loading");
    const dest = withAutoAction(href, "notify");
    if (!isLoggedIn) {
      redirectToLogin(dest);
    } else {
      window.location.href = dest;
    }
  }, [isMystery, isLoggedIn, eventId, href, redirectToLogin]);

  const handleGetTickets = useCallback(() => {
    // Send them to the event page to get a ticket. We deliberately do NOT
    // auto-create it (?ticket=true) — the event page's "Get Ticket" button gates
    // creation behind the "no bags" confirmation, which must not be skipped.
    // Logged-out users get a login hop first so they land ready in the
    // logged-in "Get Ticket" state.
    setNotifyStatus("loading");
    if (!isLoggedIn) {
      redirectToLogin(href);
    } else {
      window.location.href = href;
    }
  }, [isLoggedIn, href, redirectToLogin]);

  // Auto-complete a notify signup after returning from login on the mystery popup
  // (the only phase whose destination is a page where this popup is mounted).
  useEffect(() => {
    if (autoNotifyFiredRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("notify") !== "true") return;
    autoNotifyFiredRef.current = true;

    // Strip the flag so a refresh doesn't re-trigger it.
    params.delete("notify");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );

    if (!isLoggedIn) return; // can't sign up; popup will show the notify button
    if (initialIsNotified) {
      setNotifyStatus("success");
      return;
    }

    setNotifyStatus("loading");
    void fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speaker_id: eventId }),
    })
      .then((res) => setNotifyStatus(res.ok ? "success" : "error"))
      .catch(() => setNotifyStatus("error"));
  }, [eventId, isLoggedIn, initialIsNotified]);

  // ─── Phase-dependent content ───

  const isTicketingOpen = phase === "ticketing-open";
  const alreadyNotified = initialIsNotified || notifyStatus === "success";

  const headline = isMystery
    ? "A Mystery Speaker is Coming!"
    : speakerName || text;

  const subtitle = isMystery
    ? alreadyNotified
      ? "You'll be notified when the speaker is announced."
      : "Be the first to find out who it is."
    : isTicketingOpen
      ? "Tickets are available now!"
      : alreadyNotified
        ? "You'll be notified when tickets drop."
        : "Free tickets dropping soon.";

  const ctaLabel = isMystery
    ? alreadyNotified ? "View Event" : "Notify Me When Revealed"
    : isTicketingOpen
      ? "Get Tickets Now"
      : alreadyNotified ? "View Event" : "Notify Me When Tickets Drop";

  // ─── Render ───

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.25 }}
            className="relative w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Speaker image or mystery visual */}
            <div className="relative w-full aspect-[2/1] overflow-hidden bg-zinc-800">
              {isMystery ? (
                <>
                  <Image
                    src="/speakers/mystery.jpg"
                    alt=""
                    fill
                    className="object-cover blur-xl scale-110"
                    sizes="448px"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/50" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="text-8xl font-serif text-[#A80D0C] select-none drop-shadow-lg"
                    >
                      ?
                    </motion.span>
                  </div>
                </>
              ) : imageUrl ? (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="relative w-full h-full"
                >
                  <Image
                    src={imageUrl}
                    alt={speakerName || "Speaker"}
                    fill
                    className="object-cover"
                    sizes="448px"
                    unoptimized
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)",
                    }}
                  />
                </motion.div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
              )}
            </div>

            {/* Content */}
            <div className="px-5 sm:px-6 pt-5 pb-6 flex flex-col items-center text-center gap-4">
              {/* Headline */}
              <div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="text-xl sm:text-2xl text-white font-serif leading-tight"
                >
                  {headline}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="text-sm text-zinc-400 mt-1.5"
                >
                  {subtitle}
                </motion.p>
              </div>

              {/* Countdown */}
              {targetMs && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                >
                  <PopupCountdown targetMs={targetMs} label={prefaceLabel} />
                </motion.div>
              )}

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.4 }}
                className="w-full flex flex-col items-center gap-2.5"
              >
                {isTicketingOpen ? (
                  /* Ticketing open — send them to the event page to grab a ticket */
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGetTickets}
                    disabled={notifyStatus === "loading"}
                    animate={{
                      boxShadow: [
                        "0 0 0px rgba(168,13,12,0)",
                        "0 0 24px rgba(168,13,12,0.35)",
                        "0 0 0px rgba(168,13,12,0)",
                      ],
                    }}
                    transition={{
                      boxShadow: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      },
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg w-full px-6 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] transition-colors hover:bg-[#C11211] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {notifyStatus === "loading" ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                        </svg>
                        {ctaLabel}
                      </>
                    )}
                  </motion.button>
                ) : alreadyNotified ? (
                  /* Already signed up — just link through to the event page */
                  <Link
                    href={href}
                    onClick={dismiss}
                    prefetch={false}
                    className="w-full"
                  >
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      animate={{
                        boxShadow: [
                          "0 0 0px rgba(168,13,12,0)",
                          "0 0 24px rgba(168,13,12,0.35)",
                          "0 0 0px rgba(168,13,12,0)",
                        ],
                      }}
                      transition={{
                        boxShadow: {
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        },
                      }}
                      className="flex items-center justify-center gap-2 rounded-lg w-full px-6 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] transition-colors hover:bg-[#C11211]"
                    >
                      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {ctaLabel}
                    </motion.div>
                  </Link>
                ) : (
                  /* Not notified yet — show notify button */
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleNotify}
                    disabled={notifyStatus === "loading"}
                    animate={{
                      boxShadow: [
                        "0 0 0px rgba(168,13,12,0)",
                        "0 0 24px rgba(168,13,12,0.35)",
                        "0 0 0px rgba(168,13,12,0)",
                      ],
                    }}
                    transition={{
                      boxShadow: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      },
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg w-full px-6 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] transition-colors hover:bg-[#C11211] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {notifyStatus === "loading" ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Signing up...
                      </>
                    ) : notifyStatus === "error" ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                        </svg>
                        Try Again
                      </>
                    ) : (
                      <>
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                        </svg>
                        {ctaLabel}
                      </>
                    )}
                  </motion.button>
                )}

                {/* Dismiss link */}
                <button
                  onClick={dismiss}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                >
                  Maybe later
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
