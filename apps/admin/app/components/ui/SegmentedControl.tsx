import { cn } from "@/app/lib/cn";

type Option<T extends string> = { value: T; label: React.ReactNode };

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
};

/**
 * Inline data filter ONLY — e.g. a chart range or list filter inside a panel.
 * NEVER use for page-section navigation; use <Tabs> for that (design.md §7).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex rounded-lg bg-white/5 p-1 ring-1 ring-inset ring-white/10",
        className,
      )}
      {...rest}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            value === opt.value
              ? "bg-white/10 text-white"
              : "text-zinc-400 hover:text-zinc-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
