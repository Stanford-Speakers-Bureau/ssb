import { cn } from "@/app/lib/cn";

export const INPUT_SHELL =
  "w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-rose-500 max-sm:text-base";

/** Canonical text input (design.md §6). Forwards all native props. */
export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(INPUT_SHELL, className)} {...props} />;
}

/** Field label / eyebrow — sentence case (design.md §3). */
export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-xs font-medium tracking-wide text-zinc-400",
        className,
      )}
      {...props}
    />
  );
}
