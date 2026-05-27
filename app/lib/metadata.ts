import { BANNER_MESSAGES } from "./constants";
import type { Event } from "./supabase";

/**
 * Strip markdown formatting for use in meta description tags.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "") // headers
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1") // links → keep text
    .replace(/(`{1,3})[^`]*\1/g, "") // inline/fenced code
    .replace(/[*_]{1,3}(.+?)[*_]{1,3}/g, "$1") // bold/italic
    .replace(/^>\s?/gm, "") // blockquotes
    .replace(/^[-*]\s+/gm, "") // unordered lists
    .replace(/^\d+\.\s+/gm, "") // ordered lists
    .replace(/<[^>]+>/g, "") // HTML tags
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

/**
 * Generate an engaging event title for meta tags.
 * Uses "are" if the name contains the word "and" (e.g. "Penn & Teller and Friends").
 */
export function generateEventTitle(name: string | null): string {
  if (!name) return "Event";
  const isPlural = /\band\b/i.test(name);
  return (
    name +
    (isPlural
      ? BANNER_MESSAGES.EVENT_MESSAGE_PLURAL
      : BANNER_MESSAGES.EVENT_MESSAGE)
  );
}

/**
 * Generate a clean meta description for an event, truncated to ~155 chars.
 */
export function generateEventDescription(
  event: Pick<Event, "name" | "tagline" | "desc" | "venue">,
): string {
  if (event.tagline) return truncate(stripMarkdown(event.tagline), 155);
  if (event.desc) return truncate(stripMarkdown(event.desc), 155);
  const venue = event.venue ? ` at ${event.venue}` : "";
  return `Get free tickets to see ${event.name || "this event"}${venue}. Presented by Stanford Speakers Bureau.`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}
