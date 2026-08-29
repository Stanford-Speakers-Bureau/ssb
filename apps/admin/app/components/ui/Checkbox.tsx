import { cn } from "@/app/lib/cn";

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** When provided, renders the canonical label+checkbox row. */
  label?: React.ReactNode;
};

/** Canonical checkbox: rose accent (design.md §6). */
export function Checkbox({
  label,
  className,
  disabled,
  ...props
}: CheckboxProps) {
  const input = (
    <input
      type="checkbox"
      disabled={disabled}
      className={cn(
        "size-5 shrink-0 rounded accent-rose-500 sm:size-4",
        className,
      )}
      {...props}
    />
  );
  if (label === undefined) return input;
  return (
    <label
      className={cn(
        "flex items-center gap-2.5 text-sm",
        disabled ? "text-zinc-500" : "text-zinc-200",
      )}
    >
      {input}
      {label}
    </label>
  );
}
