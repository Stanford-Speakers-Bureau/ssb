import { cn } from "@/app/lib/cn";

type EmptyStateProps = {
  title: React.ReactNode;
  hint?: React.ReactNode;
  /** Optional action(s), e.g. a Button. */
  children?: React.ReactNode;
  className?: string;
};

/** Dashed empty state (design.md §4). */
export function EmptyState({
  title,
  hint,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {hint && <p className="mt-1 text-sm text-zinc-500">{hint}</p>}
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  );
}
