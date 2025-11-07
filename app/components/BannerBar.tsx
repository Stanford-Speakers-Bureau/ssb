"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface TimeUnitProps {
  value: string;
}

function TimeUnit({ value }: TimeUnitProps) {
  return (
    <div className="relative w-5 h-6 overflow-hidden flex items-center justify-center">
      <AnimatePresence mode="popLayout">
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

export default function BannerBar() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      
      // Find the next Wednesday at 1pm
      const targetDate = new Date(now);
      const daysUntilWednesday = (3 - now.getDay() + 7) % 7;
      
      if (daysUntilWednesday === 0) {
        // Today is Wednesday
        if (now.getHours() < 13) {
          // Before 1pm today
          targetDate.setHours(13, 0, 0, 0);
        } else {
          // After 1pm, target next Wednesday
          targetDate.setDate(now.getDate() + 7);
          targetDate.setHours(13, 0, 0, 0);
        }
      } else {
        // Target this coming Wednesday
        targetDate.setDate(now.getDate() + daysUntilWednesday);
        targetDate.setHours(13, 0, 0, 0);
      }

      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);

        return { days, hours, minutes, seconds };
      }

      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-10 justify-center flex items-center gap-3 text-sm font-semibold text-white bg-[#A80D0C]">
      <a href="/events/malala" className="underline hover:opacity-90 transition-opacity">
        SIGN UP FOR OUR FIRST SPEAKER OF THE YEAR
      </a>
      <span className="opacity-40">|</span>
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
  );
}

