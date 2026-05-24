"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export default function SubscribeToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const showSubscribedToast = searchParams.get("subscribed") === "1";
  const [visible, setVisible] = useState(showSubscribedToast);
  const cleanedUrlRef = useRef(false);

  useEffect(() => {
    if (!showSubscribedToast || cleanedUrlRef.current) return;
    cleanedUrlRef.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("subscribed");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });

    const timeout = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timeout);
  }, [showSubscribedToast, searchParams, router, pathname]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-4 z-[100] mx-auto flex w-fit max-w-[90%] items-center gap-3 rounded-full border border-[var(--ssb-accent)] bg-[var(--ssb-card)] px-5 py-3 text-sm text-[var(--ssb-ink-strong)] shadow-[0_18px_48px_rgba(0,0,0,0.4)] backdrop-blur-sm"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[var(--ssb-accent-text)]"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span>You&rsquo;re on the SSB mailing list.</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="ml-2 text-[var(--ssb-muted)] hover:text-[var(--ssb-ink-strong)]"
      >
        ×
      </button>
    </div>
  );
}
