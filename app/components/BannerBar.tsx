"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";

interface TimeUnitProps {
  value: string;
}

function TimeUnit({ value }: TimeUnitProps) {
  return (
    <div className="relative w-5 h-6 overflow-hidden flex items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute font-mono font-semibold text-base tabular-nums"
        >
          {value.padStart(2, "0")}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

interface BannerBarProps {
  href?: string;
  text?: string;
  /** Target date/time to count down to. Accepts Date, timestamp, or ISO string */
  target?: Date | string | number;
  /** Optional label shown before the timer on desktop */
  prefaceLabel?: string;
}

export default function BannerBar({
  href = "",
  text = "",
  target,
  prefaceLabel = "Tickets drop in",
}: BannerBarProps) {
  const targetTime = useMemo(() => {
    if (!target) return null;
    const t = new Date(target);
    const time = t.getTime();
    return Number.isNaN(time) ? null : time;
  }, [target]);

  const hasText = (text ?? "").trim().length > 0;
  const hasHref = (href ?? "").trim().length > 0;

  const calculateTimeLeft = (targetMs: number | null) => {
    const zero = { days: 0, hours: 0, minutes: 0, seconds: 0 };
    if (targetMs == null) return zero;
    
    const difference = targetMs - Date.now();
    if (difference > 0) {
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      return { days, hours, minutes, seconds };
    }
    return zero;
  };

  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetTime));

  useEffect(() => {
    if (targetTime == null) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTime]);

  return (
    <div className="relative z-50 h-10 justify-center flex items-center gap-3 text-sm font-semibold text-white bg-[#A80D0C]">
      {/* Mobile version - simplified */}
      {hasText && (
        hasHref ? (
          <Link href={href} className="md:hidden underline hover:opacity-90 transition-opacity">
            {text}
          </Link>
        ) : (
          <span className="md:hidden underline">
            {text}
          </span>
        )
      )}
      
      {/* Desktop version - full with countdown */}
      <div className="hidden md:flex items-center gap-3">
        {hasText && (
          hasHref ? (
            <Link href={href} className="underline hover:opacity-90 transition-opacity">
              {text}
            </Link>
          ) : (
            <span className="underline">{text}</span>
          )
        )}
        {hasText && <span className="opacity-40">|</span>}
        <span className="text-sm font-medium">{prefaceLabel}</span>
        <div className="flex items-center gap-1 font-mono text-sm">
          <TimeUnit value={String(timeLeft.days)} />
          <span className="opacity-60">:</span>
          <TimeUnit value={String(timeLeft.hours)} />
          <span className="opacity-60">:</span>
          <TimeUnit value={String(timeLeft.minutes)} />
          <span className="opacity-60">:</span>
          <TimeUnit value={String(timeLeft.seconds)} />
        </div>
      </div>
    </div>
  );
}

