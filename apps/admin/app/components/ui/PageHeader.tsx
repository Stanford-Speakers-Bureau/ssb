import { cn } from "@/app/lib/cn";

type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned actions slot. */
  children?: React.ReactNode;
  className?: string;
};

/** Page title + subtitle (design.md §3). font-serif font-semibold — never font-bold. */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-balance text-white sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-prose text-sm text-pretty text-zinc-400">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  );
}
