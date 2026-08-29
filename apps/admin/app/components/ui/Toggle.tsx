import { cn } from "@/app/lib/cn";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
};

/** Switch toggle: turns rose when checked (design.md §6). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  className,
  ...rest
}: ToggleProps) {
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 ring-inset ring-white/10 transition-colors disabled:opacity-50",
        checked ? "bg-rose-500" : "bg-white/10",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
  if (label === undefined) return button;
  return (
    <label className="flex items-center gap-2.5 text-sm text-zinc-200">
      {button}
      {label}
    </label>
  );
}
