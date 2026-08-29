import { useEffect } from "react";
import {
  BulkSendProgressState,
  getProcessedCount,
  getSkipBreakdownSegments,
} from "@/app/lib/bulkSend";

type BulkSendProgressProps = {
  state: BulkSendProgressState;
  onDismiss?: () => void;
};

export default function BulkSendProgress({
  state,
  onDismiss,
}: BulkSendProgressProps) {
  useEffect(() => {
    if (!state.active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.active]);
  const processed = getProcessedCount(state);
  const percentComplete =
    state.total > 0 ? Math.round((processed / state.total) * 100) : 0;
  const barColor = state.done
    ? state.failed === 0
      ? "bg-emerald-500"
      : "bg-amber-500"
    : "bg-rose-500";
  const skipSegments = getSkipBreakdownSegments(state);
  const completeSummary = [
    `${state.sent} sent`,
    ...(state.failed > 0 ? [`${state.failed} failed`] : []),
    ...skipSegments,
  ].join(", ");

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-200">
          {state.active
            ? `${state.label}... ${processed}/${state.total}`
            : `${state.label} complete. ${completeSummary}`}
        </p>
        {state.done && onDismiss ? (
          <button
            onClick={onDismiss}
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Dismiss
          </button>
        ) : null}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{
            width: `${state.total > 0 ? (processed / state.total) * 100 : 0}%`,
          }}
        />
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">
        {percentComplete}% complete
        {state.failed > 0 ? (
          <span className="text-rose-400"> • {state.failed} failed</span>
        ) : null}
        {skipSegments.map((segment) => (
          <span key={segment} className="text-amber-400">
            {" "}
            • {segment}
          </span>
        ))}
      </p>
      {state.active && (
        <p className="mt-2 text-xs text-amber-400">
          Please don&apos;t close or navigate away from this tab while emails
          are sending.
        </p>
      )}
    </div>
  );
}
