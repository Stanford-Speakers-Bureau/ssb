import { cn } from "@/app/lib/cn";
import { DOT_COLORS, type SemanticColor } from "./tokens";

type ChipProps = {
  label: React.ReactNode;
  scope?: React.ReactNode;
  dotColor?: SemanticColor;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
};

/** Removable chip with optional semantic dot (design.md §8). */
export function Chip({
  label,
  scope,
  dotColor,
  onRemove,
  removeLabel = "Remove",
  className,
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-white/5 py-1 pr-1 pl-2 text-xs ring-1 ring-inset ring-white/10",
        !onRemove && "pr-2",
        className,
      )}
    >
      {dotColor && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", DOT_COLORS[dotColor])}
        />
      )}
      <span className="font-medium text-zinc-200">{label}</span>
      {scope && <span className="text-zinc-500">{scope}</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="ml-0.5 flex size-4 items-center justify-center rounded text-zinc-500 hover:bg-white/10 hover:text-rose-400"
        >
          ✕
        </button>
      )}
    </span>
  );
}
