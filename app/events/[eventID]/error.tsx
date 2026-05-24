"use client";

import { useEffect } from "react";
import Link from "next/link";

type EventErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function EventErrorPage({
  error,
  reset,
}: EventErrorPageProps) {
  useEffect(() => {
    console.error("Event page error boundary caught an error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-2xl border p-8 text-center shadow-sm border-[var(--ssb-border)] bg-[var(--ssb-card)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ssb-accent-text)]">
          Event unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--ssb-ink-strong)]">
          We couldn&apos;t load this event right now.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ssb-muted)]">
          Try again in a moment. Your ticket is not affected.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-xl bg-[var(--ssb-accent)] px-5 py-3 text-sm font-medium text-[var(--ssb-accent-contrast)] transition-colors hover:bg-[var(--ssb-accent-strong)]"
          >
            Retry event
          </button>
          <Link
            href="/upcoming-speakers"
            className="rounded-xl border px-5 py-3 text-sm font-medium transition-colors border-[var(--ssb-border)] text-[var(--ssb-muted)] hover:bg-[var(--ssb-card-strong)]"
          >
            Browse events
          </Link>
        </div>
      </div>
    </div>
  );
}
