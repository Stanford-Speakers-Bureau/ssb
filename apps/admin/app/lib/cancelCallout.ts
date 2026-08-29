// Shared, dependency-free helpers for the campaign "please cancel" callout.
// Safe to import from both server (email rendering, API routes) and client
// (the editor preview) — no crypto or Node-only APIs.

export const DEFAULT_CANCEL_CALLOUT_TEXT =
  "Can't make it? [Please cancel] so someone else can attend.";

/**
 * Splits the customizable callout copy into the text around the clickable
 * cancel link. The link is the first [square-bracketed] span; if there are no
 * brackets the whole sentence becomes the link.
 */
export function parseCancelCalloutText(raw: string | null | undefined): {
  prefix: string;
  label: string;
  suffix: string;
} {
  const text = (raw ?? "").trim() || DEFAULT_CANCEL_CALLOUT_TEXT;
  const match = text.match(/\[([^\]]+)\]/);
  if (!match) {
    return { prefix: "", label: text, suffix: "" };
  }
  const start = match.index ?? 0;
  return {
    prefix: text.slice(0, start),
    label: match[1],
    suffix: text.slice(start + match[0].length),
  };
}
