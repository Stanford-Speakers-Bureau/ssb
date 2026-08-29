/** Semantic data colors (design.md §2). Interaction accents are always rose
 *  and are hardcoded inside Button/Tabs/Input/Checkbox — these are for DATA:
 *  charts, metric numbers, status dots, status/affiliation/action badges. */
export type SemanticColor =
  | "emerald"
  | "amber"
  | "rose"
  | "blue"
  | "violet"
  | "sky"
  | "teal"
  | "pink"
  | "zinc";

/** Tinted pill backgrounds (StatusPill). */
export const PILL_TINTS: Record<SemanticColor, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/25",
  amber: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/25",
  rose: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/25",
  blue: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/25",
  violet: "bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/25",
  sky: "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/25",
  teal: "bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/25",
  pink: "bg-pink-500/15 text-pink-300 ring-1 ring-inset ring-pink-500/25",
  zinc: "bg-white/5 text-zinc-400 ring-1 ring-inset ring-white/10",
};

/** Solid dot colors (Chip / status dots). */
export const DOT_COLORS: Record<SemanticColor, string> = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  blue: "bg-blue-400",
  violet: "bg-violet-400",
  sky: "bg-sky-400",
  teal: "bg-teal-400",
  pink: "bg-pink-400",
  zinc: "bg-zinc-400",
};
