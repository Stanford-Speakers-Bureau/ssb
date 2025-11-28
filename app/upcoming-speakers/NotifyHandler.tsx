"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function NotifyHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasSubmitted = useRef(false);

  useEffect(() => {
    const eventId = searchParams.get("notify");
    if (!eventId || hasSubmitted.current) return;

    hasSubmitted.current = true;

    async function submitNotify() {
      try {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speaker_id: eventId }),
        });

        // Refresh the page to show updated notification status on the card
        router.replace("/upcoming-speakers");
        router.refresh();
      } catch {
        // Silently fail - user can try again via the card
      }
    }

    submitNotify();
  }, [searchParams, router]);

  return null;
}
