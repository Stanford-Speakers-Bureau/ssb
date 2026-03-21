import { defaultSchema } from "rehype-sanitize";
import type { Options as SanitizeOptions } from "rehype-sanitize";

/**
 * Tight HTML sanitize schema for admin-authored markdown.
 * Allows basic formatting and links but strips scripts, event handlers,
 * and javascript: URIs.
 */
export const sanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
  },
  tagNames: [
    "a", "b", "blockquote", "br", "code", "em", "h1", "h2", "h3", "h4",
    "h5", "h6", "hr", "i", "li", "ol", "p", "pre", "s", "strong",
    "sub", "sup", "u", "ul", "span", "div", "del", "img",
  ],
};
