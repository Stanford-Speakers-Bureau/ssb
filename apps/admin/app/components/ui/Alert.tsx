import { cn } from "@/app/lib/cn";

type AlertTone = "error" | "success";

const TONES: Record<AlertTone, { box: string; text: string; dismiss: string }> =
  {
    error: {
      box: "bg-rose-500/10 ring-rose-500/25",
      text: "text-rose-300",
      dismiss: "text-rose-400 hover:text-rose-300",
    },
    success: {
      box: "bg-emerald-500/10 ring-emerald-500/25",
      text: "text-emerald-300",
      dismiss: "text-emerald-400 hover:text-emerald-300",
    },
  };

type AlertProps = {
  tone: AlertTone;
  onDismiss?: () => void;
  children: React.ReactNode;
  className?: string;
};

/** Inline alert (design.md §9). */
export function Alert({ tone, onDismiss, children, className }: AlertProps) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg p-3.5 ring-1 ring-inset",
        t.box,
        className,
      )}
    >
      <p className={cn("flex-1 text-sm", t.text)}>{children}</p>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className={t.dismiss}
        >
          ✕
        </button>
      )}
    </div>
  );
}
