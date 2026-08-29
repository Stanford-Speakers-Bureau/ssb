import { cn } from "@/app/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50",
  secondary:
    "rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 ring-1 ring-inset ring-white/10 hover:bg-white/10",
  ghost:
    "rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Danger affordance for secondary/ghost: text turns rose on hover (design.md §5). */
  danger?: boolean;
};

/**
 * Canonical button. Only ONE filled `primary` per page (a dialog counts as its
 * own page). Inline form actions use `ghost`/`secondary` at the smaller size.
 * `type` defaults to "button" — set `type="submit"` inside forms.
 */
export function Button({
  variant = "secondary",
  danger = false,
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        VARIANTS[variant],
        danger && variant !== "primary" && "hover:text-rose-400",
        className,
      )}
      {...props}
    />
  );
}
