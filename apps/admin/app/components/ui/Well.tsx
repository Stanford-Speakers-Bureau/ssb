import { cn } from "@/app/lib/cn";

/** Inner well: nested secondary group inside a card (design.md §4). */
export function Well({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/10",
        className,
      )}
      {...props}
    />
  );
}
