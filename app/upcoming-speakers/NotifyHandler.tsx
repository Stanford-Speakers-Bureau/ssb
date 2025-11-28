"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function NotifyHandler() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const eventId = searchParams.get("notify");
    if (!eventId) return;

    async function submitNotify() {
      try {
        const response = await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speaker_id: eventId }),
        });

        const data = await response.json();

        if (response.ok) {
          setMessage({ type: "success", text: "You'll be notified when the speaker is announced!" });
        } else if (response.status === 409) {
          setMessage({ type: "success", text: "You're already signed up for notifications!" });
        } else {
          setMessage({ type: "error", text: data.error || "Something went wrong" });
        }

        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete("notify");
        window.history.replaceState({}, "", url.toString());
      } catch {
        setMessage({ type: "error", text: "Something went wrong. Please try again." });
      }
    }

    submitNotify();
  }, [searchParams]);

  if (!message) return null;

  return (
    <div className={`mb-6 p-4 rounded-lg ${
      message.type === "success" 
        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" 
        : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
    }`}>
      {message.text}
    </div>
  );
}

