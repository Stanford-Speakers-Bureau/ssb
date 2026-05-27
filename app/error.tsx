"use client";

import { useEffect } from "react";
import Link from "next/link";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Web app error boundary caught an error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center bg-zinc-950">
      <div className="w-full max-w-xl rounded-2xl border p-8 shadow-sm border-zinc-800 bg-zinc-900">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
          Something went wrong
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          We hit an unexpected error.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          Please try again. If the issue keeps happening, contact{" "}
          <a
            href="mailto:tickets@stanfordspeakersbureau.com"
            className="font-medium underline underline-offset-2 text-zinc-100"
          >
            tickets@stanfordspeakersbureau.com
          </a>
          .
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-xl bg-[#A80D0C] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#8E0B0A]"
          >
            Try again
          </button>
          <Link
            href="/upcoming-speakers"
            className="rounded-xl border px-5 py-3 text-sm font-medium transition-colors border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          >
            Back to events
          </Link>
        </div>
      </div>
    </div>
  );
}
