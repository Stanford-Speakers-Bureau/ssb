"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

type EventScopedFetchResult<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  /** Re-run the fetch for the current event (e.g. after a mutation). */
  refetch: () => void;
};

type Options = {
  /** Runs when there is no event id, so the consumer can clear derived UI. */
  onReset?: () => void;
};

/**
 * Loads data scoped to the selected event while guarding against stale
 * responses. The request is keyed on `eventId`; when the event changes (or the
 * component unmounts) the in-flight request is aborted and its late result is
 * ignored, so the most recent selection always wins. This centralises the
 * cancellation pattern used in CheckInClient so every event-scoped page is safe
 * to switch away from mid-load.
 */
export function useEventScopedFetch<T>(
  eventId: string | null | undefined,
  fetcher: (eventId: string, signal: AbortSignal) => Promise<T>,
  options?: Options,
): EventScopedFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => !!eventId);
  const [refetchKey, setRefetchKey] = useState(0);

  const refetch = useCallback(() => setRefetchKey((key) => key + 1), []);

  // Effect Events keep the latest `fetcher`/`onReset` closures without making
  // them reactive, so the effect only re-runs on eventId/refetchKey — and the
  // setState calls live here rather than in the effect body.
  const runFetch = useEffectEvent((id: string, signal: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    fetcher(id, signal)
      .then((result) => {
        if (!signal.aborted) setData(result);
      })
      .catch((err: unknown) => {
        if (
          signal.aborted ||
          (err as { name?: string } | null)?.name === "AbortError"
        ) {
          return;
        }
        console.error("Event-scoped fetch failed:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false);
      });
  });

  const handleReset = useEffectEvent(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    options?.onReset?.();
  });

  useEffect(() => {
    if (!eventId) {
      handleReset();
      return;
    }
    const controller = new AbortController();
    runFetch(eventId, controller.signal);
    return () => controller.abort();
  }, [eventId, refetchKey]);

  return { data, error, isLoading, refetch };
}
