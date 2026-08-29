"use client";

import { useEffect } from "react";

// Smoothly scrolls to the element named by the URL hash on mount. Cross-route
// `<Link href="...#id">` navigation doesn't reliably scroll on long pages, so
// this guarantees it (and respects the target's `scroll-mt-*` offset).
export default function ScrollToHash() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const raf = requestAnimationFrame(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
