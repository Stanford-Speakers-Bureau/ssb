import posthog, { type CaptureResult } from "posthog-js";

import { POSTHOG_KEY } from "@/app/lib/constants";

// Substrings of exception messages we never want in Error Tracking. These all
// originate outside our app — browser extensions, in-app webview JS bridges,
// crypto-wallet injectors, and email link scanners (e.g. Outlook SafeLinks) —
// and drowned out real bugs in the data. Matched against the exception's
// message text; keep this list tight so we don't hide genuine errors.
const IGNORED_EXCEPTION_PATTERNS = [
  "Script error.", // cross-origin script error with no actionable detail
  "__firefox__", // Firefox iOS / Focus content scripts
  "_AutofillCallbackHandler", // mobile autofill bridge
  "window.ethereum", // crypto wallet extensions
  "webkit.messageHandlers", // iOS in-app webview bridge
  "Object Not Found Matching Id", // Outlook SafeLink / email prefetch scanners
  "og:type", // social/meta scrapers reading og meta tags
  "ResizeObserver loop", // benign browser layout notice
];

function isIgnoredException(event: CaptureResult): boolean {
  if (event.event !== "$exception") return false;

  const props = event.properties ?? {};
  const values = Array.isArray(props.$exception_values)
    ? (props.$exception_values as unknown[])
    : [];
  const list = Array.isArray(props.$exception_list)
    ? (props.$exception_list as Array<{ value?: unknown }>)
    : [];

  const haystack = [
    ...values.map((v) => String(v ?? "")),
    ...list.map((entry) => String(entry?.value ?? "")),
  ].join(" ");

  return IGNORED_EXCEPTION_PATTERNS.some((pattern) =>
    haystack.includes(pattern),
  );
}

// Only run analytics on the deployed site. A developer running a local build
// (even a production `next build`) was leaking events — including unrelated
// `/mockups` compile errors — into the production project; gating on hostname
// keeps that noise out without depending on NODE_ENV.
const host = typeof window !== "undefined" ? window.location.hostname : "";
const isLocalHost =
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "::1" ||
  host.endsWith(".local");

if (typeof window !== "undefined" && !isLocalHost) {
  posthog.init(POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    // Include the defaults option as required by PostHog
    defaults: "2026-01-30",
    // Enables capturing unhandled exceptions via Error Tracking
    capture_exceptions: true,
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
    },
    // Drop third-party / extension noise so Error Tracking reflects real bugs.
    before_send: (event) => {
      if (event && isIgnoredException(event)) return null;
      return event;
    },
    // Turn on debug in development mode
    debug: process.env.NODE_ENV === "development",
  });
}
