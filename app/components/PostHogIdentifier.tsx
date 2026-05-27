"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Links the anonymous client-side PostHog identity to the email-based identity
 * the server uses (see posthog-server captures + the SSO callback `identify`).
 *
 * Without this, posthog-js events (ticketing, replay, autocapture) live under an
 * anonymous distinct_id while server events (`user_signed_in`, feedback, votes)
 * live under the user's email — two separate persons that never merge. On mount
 * we ask the session endpoint who the user is and `identify()` to the same email,
 * which aliases the prior anonymous id so earlier anonymous activity merges in.
 */
export default function PostHogIdentifier() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          authenticated?: boolean;
          distinctId?: string | null;
        };
        if (cancelled) return;

        if (data.authenticated && data.distinctId) {
          if (posthog.get_distinct_id() !== data.distinctId) {
            posthog.identify(data.distinctId);
          }
        } else if (posthog._isIdentified()) {
          // Session ended elsewhere — start a fresh anonymous identity.
          posthog.reset();
        }
      } catch {
        // Identity linking is best-effort; never block the page on it.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
