import { cn } from "@/app/lib/cn";
import { INPUT_SHELL } from "./Input";

/** Canonical textarea — same shell as Input (design.md §6). */
export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(INPUT_SHELL, className)} {...props} />;
}
