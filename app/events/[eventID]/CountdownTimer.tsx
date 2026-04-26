"use client";

import { useState, useEffect } from "react";

type CountdownTimerProps = {
  targetDate: Date;
  label?: string;
  onExpire?: () => void;
};

function calcTimeLeft(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export default function CountdownTimer({
  targetDate,
  label,
  onExpire,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(targetDate));

  useEffect(() => {
    const tick = () => {
      const next = calcTimeLeft(targetDate);
      setTimeLeft(next);
      if (!next) {
        clearInterval(id);
        onExpire?.();
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate, onExpire]);

  if (!timeLeft) return null;

  const segments = [
    ...(timeLeft.days > 0
      ? [{ value: timeLeft.days, label: "days" }]
      : []),
    { value: timeLeft.hours, label: "hrs" },
    { value: timeLeft.minutes, label: "min" },
    { value: timeLeft.seconds, label: "sec" },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
          {label}
        </p>
      )}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {segments.map((seg, i) => (
          <div key={seg.label} className="flex items-center gap-1.5 sm:gap-2">
            {i > 0 && (
              <span className="text-xl font-bold text-zinc-600 -mt-4">
                :
              </span>
            )}
            <div className="flex flex-col items-center">
              <div className="rounded-lg bg-white/[0.06] border border-white/10 px-2.5 sm:px-3 py-1.5 sm:py-2 min-w-[3rem] sm:min-w-[3.5rem] flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-bold tabular-nums text-white">
                  {String(seg.value).padStart(2, "0")}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 mt-1">
                {seg.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
