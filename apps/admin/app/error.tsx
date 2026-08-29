"use client";

import { useEffect } from "react";
import Link from "next/link";

type AdminErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminErrorPage({ error, reset }: AdminErrorPageProps) {
  useEffect(() => {
    console.error("Admin app error boundary caught an error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16 text-center dark:bg-zinc-950">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-zinc-50 p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
          Admin error
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-zinc-950 dark:text-white">
          We couldn&apos;t finish that admin request.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Retry the page. If it keeps failing, check the deployment logs before
          making more launch-time changes.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          >
            Retry
          </button>
          <Link
            href="/"
            className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Admin home
          </Link>
        </div>
      </div>
    </div>
  );
}
