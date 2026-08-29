"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/16/solid";

type ConfirmationTone = "primary" | "danger";

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: ConfirmationTone;
  dismissible?: boolean;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export type ConfirmationOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: ConfirmationTone;
};

// The confirm button is the single primary action of the dialog, so a filled
// rose button is canonical for both tones (design.md §5). The leading icon ring
// carries the success/danger distinction.
const TONE_STYLES: Record<ConfirmationTone, string> = {
  primary: "bg-rose-500 text-white hover:bg-rose-400",
  danger: "bg-rose-500 text-white hover:bg-rose-400",
};

function renderDescription(description: ReactNode) {
  if (typeof description === "string") {
    return <p className="text-sm leading-6 text-zinc-400">{description}</p>;
  }

  return <div className="text-sm leading-6 text-zinc-400">{description}</div>;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  dismissible = true,
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissible && !isConfirming) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismissible, isConfirming, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (
          dismissible &&
          !isConfirming &&
          event.target === event.currentTarget
        ) {
          onCancel();
        }
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
      >
        <div className="flex items-start gap-4">
          <div
            className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
              tone === "danger"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {tone === "danger" ? (
              <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="confirmation-dialog-title"
              className="text-lg font-semibold text-white"
            >
              {title}
            </h2>
            {description ? (
              <div className="mt-2">{renderDescription(description)}</div>
            ) : null}
            {children ? <div className="mt-4">{children}</div> : null}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            autoFocus
            className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${TONE_STYLES[tone]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirmationDialog() {
  const [pendingConfirmation, setPendingConfirmation] =
    useState<ConfirmationOptions | null>(null);
  const resolverRef = useRef<((result: boolean) => void) | null>(null);

  const closeConfirmation = useCallback((result: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPendingConfirmation(null);
    resolve?.(result);
  }, []);

  const confirm = useCallback((options: ConfirmationOptions) => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPendingConfirmation(options);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
    };
  }, []);

  return {
    confirm,
    confirmationDialog: (
      <ConfirmationDialog
        open={pendingConfirmation !== null}
        title={pendingConfirmation?.title ?? ""}
        description={pendingConfirmation?.description}
        confirmLabel={pendingConfirmation?.confirmLabel}
        cancelLabel={pendingConfirmation?.cancelLabel}
        tone={pendingConfirmation?.tone}
        onConfirm={() => closeConfirmation(true)}
        onCancel={() => closeConfirmation(false)}
      />
    ),
  };
}
