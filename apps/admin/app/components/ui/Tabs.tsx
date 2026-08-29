import { cn } from "@/app/lib/cn";
import { CountPill } from "./CountPill";

/** Underline tab bar — the canonical page-section navigation (design.md §7). */
export function Tabs({
  className,
  wrap = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { wrap?: boolean }) {
  return (
    <div
      className={cn(
        "flex gap-x-6 border-b border-white/10",
        wrap ? "flex-wrap" : "overflow-x-auto",
        className,
      )}
      {...props}
    />
  );
}

type TabProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active: boolean;
  count?: number;
};

/**
 * A single underline tab. Never changes font-weight between states —
 * color + underline only (design.md §7).
 */
export function Tab({
  active,
  count,
  className,
  children,
  ...props
}: TabProps) {
  return (
    <button
      type="button"
      className={cn(
        "-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap",
        active
          ? "border-rose-500 text-white"
          : "border-transparent text-zinc-400 hover:text-zinc-200",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && <CountPill active={active}>{count}</CountPill>}
    </button>
  );
}
