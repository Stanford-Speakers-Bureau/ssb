"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";

type WaitForImagesProps = {
  urls: string[];
  children: ReactNode;
  fallback?: ReactNode;
  /**
   * Limits how many images we block on (after de-duping). Useful to avoid waiting
   * for every image on long lists.
   */
  maxToWait?: number;
  /**
   * Safety valve: if images are slow or blocked, proceed after this timeout.
   */
  timeoutMs?: number;
};

export default function WaitForImages({
  urls,
  children,
  fallback = null,
  maxToWait,
  timeoutMs = 8000,
}: WaitForImagesProps) {
  const uniqueUrls = useMemo(() => {
    const cleaned = (urls || []).filter(Boolean);
    const unique = Array.from(new Set(cleaned));
    return typeof maxToWait === "number" ? unique.slice(0, maxToWait) : unique;
  }, [urls, maxToWait]);

  const urlsKey = useMemo(() => uniqueUrls.join("||"), [uniqueUrls]);
  const [ready, setReady] = useState(uniqueUrls.length === 0);

  useEffect(() => {
    let cancelled = false;
    setReady(uniqueUrls.length === 0);

    if (uniqueUrls.length === 0) return;

    let settled = 0;
    const total = uniqueUrls.length;

    const markSettled = () => {
      settled += 1;
      if (!cancelled && settled >= total) setReady(true);
    };

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            if (!cancelled) setReady(true);
          }, timeoutMs)
        : null;

    uniqueUrls.forEach((url) => {
      const img = new Image();
      img.onload = markSettled;
      img.onerror = markSettled;
      img.src = url;
      // If already cached, onload may not fire reliably in all browsers.
      if (img.complete) markSettled();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey, timeoutMs]);

  return ready ? children : fallback;
}


