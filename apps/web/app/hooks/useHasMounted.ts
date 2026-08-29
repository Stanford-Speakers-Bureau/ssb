import { useSyncExternalStore } from "react";

/**
 * Returns `false` on the server and during the first client render, then `true`
 * after the component has mounted.
 *
 * Use it to gate any UI whose value depends on the current time (or other
 * client-only state) so the server-rendered HTML and the first client render
 * always match. This prevents React hydration errors (#418) — including the
 * case where Mobile Safari restores a stale page from its back/forward cache
 * and re-hydrates it long after the HTML was generated, by which point a
 * `new Date()` computed during render no longer matches the server's value.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
