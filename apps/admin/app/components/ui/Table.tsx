import { cn } from "@/app/lib/cn";

/** Bare table — no card wrapper, no vertical lines, no outer border (design.md §10). */
export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full", className)} {...props} />;
}

/** Scroll wrapper for tables whose columns overflow (the two-div pattern). */
export function TableScroll({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-6">
      <div
        className={cn(
          "inline-block min-w-full px-4 align-middle sm:px-6",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />;
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-white/10", className)} {...props} />
  );
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={className} {...props} />;
}

/** Sentence-case header cell (design.md §10). */
export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "py-2 pr-3 text-left text-sm font-medium whitespace-nowrap text-zinc-400",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("py-3 pr-3 text-sm text-white", className)} {...props} />
  );
}
