"use client";

import { useEffect } from "react";
import Link from "next/link";

type EventErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function EventErrorPage({ error, reset }: EventErrorPageProps) {
  useEffect(() => {
    console.error("Event page error boundary caught an error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-2xl border p-8 text-center shadow-sm border-zinc-800 bg-zinc-900">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
          Event unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          We couldn&apos;t load this event right now.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          Try again in a moment. Your ticket is not affected.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-xl bg-[#A80D0C] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#8E0B0A]"
          >
            Retry event
          </button>
          <Link
            href="/upcoming-speakers"
            className="rounded-xl border px-5 py-3 text-sm font-medium transition-colors border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          >
            Browse events
          </Link>
        </div>
      </div>
    </div>
  );
}
