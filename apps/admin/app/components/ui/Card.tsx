import { cn } from "@/app/lib/cn";

type CardProps = React.HTMLAttributes<HTMLElement> & {
  as?: "section" | "div";
};

/** Card / section surface (design.md §4). */
export function Card({ as = "section", className, ...props }: CardProps) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-white/10 bg-zinc-900/60 p-5 sm:p-6",
        className,
      )}
      {...props}
    />
  );
}
