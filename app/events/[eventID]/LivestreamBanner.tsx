"use client";

import { useState } from "react";
import { LIVESTREAM_STARTS_SOON_MS } from "@/app/lib/constants";

function getTimeUntil(dateString: string, now: number): string | null {
  const target = new Date(dateString).getTime();
  const diff = target - now;
  if (diff <= 0) return null;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days} day${days === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  if (minutes > 0) return `${minutes} min`;
  return null;
}

type LivestreamBannerProps = {
  livestreamUrl: string;
  eventStartTime: string | null;
};

export default function LivestreamBanner({
  livestreamUrl,
  eventStartTime,
}: LivestreamBannerProps) {
  const [nowMs] = useState(() => Date.now());
  const showLinks =
    eventStartTime &&
    new Date(eventStartTime).getTime() - nowMs <= LIVESTREAM_STARTS_SOON_MS;
  const timeUntil = eventStartTime ? getTimeUntil(eventStartTime, nowMs) : null;

  if (showLinks) {
    return (
      <div className="relative rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600 via-purple-600 to-orange-500" />
        <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400/20 via-transparent to-purple-500/30" />
        <div className="relative px-5 py-4 sm:py-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-300" />
              </span>
              Live
            </span>
            <p className="text-sm sm:text-base font-bold text-white leading-snug">
              Watch the livestream
            </p>
          </div>
          <div className="flex gap-2.5">
            <a
              href={livestreamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex-1 flex items-center gap-3 rounded-lg bg-white/15 backdrop-blur-sm ring-1 ring-white/20 px-4 py-3 transition-all hover:bg-white/25"
            >
              <svg className="w-6 h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <span className="text-sm font-semibold text-white">Watch Live</span>
              <svg className="w-4 h-4 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all ml-auto flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600 via-purple-600 to-orange-500" />
      <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400/20 via-transparent to-purple-500/30" />
      <div className="relative px-5 py-4 sm:py-5 flex items-center gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/25">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-bold text-white leading-snug">
            This event will be livestreamed to the public!
            {timeUntil && (
              <span className="font-normal text-white/80">
                {" "}in {timeUntil}
              </span>
            )}
          </p>
          <p className="text-xs sm:text-sm text-white/75 mt-0.5">
            A link will be available closer to the event
          </p>
        </div>
      </div>
    </div>
  );
}
