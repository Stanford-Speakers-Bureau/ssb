import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { cn } from "@/app/lib/cn";
import { INPUT_SHELL } from "./Input";

/** Canonical select: input shell + custom chevron (design.md §6). */
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="grid grid-cols-[1fr_--spacing(8)] items-center">
      <select
        className={cn(
          INPUT_SHELL,
          "col-start-1 row-start-1 appearance-none pr-8",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none col-start-1 row-start-1 mr-2 size-4 shrink-0 justify-self-end text-zinc-500"
      />
    </div>
  );
}
