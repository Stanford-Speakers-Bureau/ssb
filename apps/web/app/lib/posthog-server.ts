import { after } from "next/server";
import { PostHog } from "posthog-node";

import { POSTHOG_HOST, POSTHOG_KEY } from "@/app/lib/constants";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

/**
 * Capture a conversion event server-side, where the DB commit actually
 * happens, so it can't be lost to ad-blockers, client navigation, or a tab
 * closing before the browser SDK flushes. Runs after the response via
 * `after()`, so it never adds latency to the user's request, and swallows
 * its own errors so analytics can never break the ticketing flow.
 */
export function captureServerEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  groups?: Record<string, string>;
}) {
  after(async () => {
    try {
      const posthog = getPostHogClient();
      posthog.capture(params);
      await posthog.flush();
    } catch (error) {
      console.error(`PostHog capture error (${params.event}):`, error);
    }
  });
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
