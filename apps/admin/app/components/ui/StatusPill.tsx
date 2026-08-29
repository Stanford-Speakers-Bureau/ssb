import { cn } from "@/app/lib/cn";
import { DOT_COLORS, PILL_TINTS, type SemanticColor } from "./tokens";

type StatusPillProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Required: forces explicit semantic intent (design.md §2/§8). */
  color: SemanticColor;
  /** Render a leading status dot. */
  dot?: boolean;
};

/** Tinted, semantic status pill (design.md §8). Keeps data/status hue. */
export function StatusPill({
  color,
  dot = false,
  className,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        PILL_TINTS[color],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", DOT_COLORS[color])}
        />
      )}
      {children}
    </span>
  );
}
