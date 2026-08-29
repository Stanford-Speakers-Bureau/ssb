import { cn } from "@/app/lib/cn";

type CountPillProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Rose-tinted when true (e.g. inside an active tab). */
  active?: boolean;
};

/** Neutral count pill; rose-tinted when active (design.md §8). */
export function CountPill({
  active = false,
  className,
  ...props
}: CountPillProps) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs tabular-nums",
        active ? "bg-rose-500/15 text-rose-300" : "bg-white/5 text-zinc-400",
        className,
      )}
      {...props}
    />
  );
}
