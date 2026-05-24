"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { sanitizeSchema } from "@/app/lib/sanitize";

// ─── Design token constants ───

export const glassPanel =
  "rounded-xl bg-[var(--ssb-card)] border border-[var(--ssb-border)] shadow-lg";

export const redButtonBase =
  "rounded-lg px-6 py-3 text-sm sm:text-base font-semibold text-[var(--ssb-accent-contrast)] bg-[var(--ssb-accent)] transition-all hover:bg-[var(--ssb-accent-strong)] hover:shadow-lg hover:shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

const secondaryButtonBase =
  "rounded-lg border border-[var(--ssb-border)] bg-white/[0.06] px-6 py-3 text-sm sm:text-base font-semibold text-[var(--ssb-muted)] transition-all hover:bg-white/[0.1] hover:text-[var(--ssb-ink-strong)] hover:border-[var(--ssb-border-strong)] disabled:opacity-50 disabled:cursor-not-allowed";

// ─── Spinner ───

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={`w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin ${className ?? ""}`}
    />
  );
}

// ─── FeedbackMessage (toast) ───

export function FeedbackMessage({
  message,
}: {
  message: string | null;
  className?: string;
}) {
  if (typeof document === "undefined") return null;

  const lowered = message?.toLowerCase() ?? "";
  const isSuccess =
    lowered.includes("successfully") ||
    lowered.includes("created") ||
    lowered.includes("cancelled") ||
    lowered.includes("confirmed");
  const isInfo =
    lowered.includes("processing") ||
    lowered.includes("checking") ||
    lowered.includes("waiting") ||
    lowered.includes("longer than usual") ||
    lowered.includes("still be processing");
  const toneClass = isSuccess
    ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
    : isInfo
      ? "bg-amber-500/15 border-amber-500/25 text-amber-300"
      : "bg-red-500/15 border-red-500/25 text-red-300";

  return createPortal(
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-xl border text-sm font-medium ${toneClass}`}
        >
          <span className="flex items-center gap-2">
            {isSuccess ? (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : isInfo ? (
              <svg className="w-4 h-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                <path
                  d="M12 2a10 10 0 1 0 10 10"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            )}
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── RedButton ───

export function RedButton({
  onClick,
  disabled,
  loading,
  loadingText,
  children,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      whileHover={isDisabled ? {} : { scale: 1.02 }}
      whileTap={isDisabled ? {} : { scale: 0.98 }}
      onClick={onClick}
      disabled={isDisabled}
      className={`${redButtonBase} w-full ${className ?? ""}`}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}

// ─── NoticeBanner ───

const noticeBannerColors = {
  red: "bg-[var(--ssb-accent-soft)] border-[var(--ssb-accent)]/40 text-[var(--ssb-accent-text)]",
  amber: "bg-amber-500/[0.06] border-amber-500/20 text-amber-200",
  blue: "bg-blue-500/[0.06] border-blue-500/20 text-blue-200",
  zinc: "bg-zinc-500/[0.06] border-zinc-500/20 text-zinc-200",
} as const;

const noticeBannerIconColors = {
  red: "text-[var(--ssb-accent-text)]",
  amber: "text-amber-400",
  blue: "text-blue-400",
  zinc: "text-zinc-400",
} as const;

export function NoticeBanner({
  icon,
  children,
  color = "amber",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  color?: keyof typeof noticeBannerColors;
}) {
  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${noticeBannerColors[color]}`}>
      <div className="flex items-start gap-2">
        <span className={`shrink-0 mt-0.5 ${noticeBannerIconColors[color]}`}>{icon}</span>
        <div className="min-w-0 flex-1 text-xs sm:text-sm font-medium leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── PriorityBanner ───

export function PriorityBanner({ priorityText }: { priorityText: string }) {
  return (
    <NoticeBanner
      color="amber"
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      }
    >
      <div className="prose prose-sm prose-amber prose-invert prose-p:m-0 prose-a:underline max-w-none">
        <ReactMarkdown rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}>{priorityText}</ReactMarkdown>
      </div>
    </NoticeBanner>
  );
}

// ─── NoBagsModalChildren ───

export function NoBagsModalChildren({
  value,
  onChange,
  onConfirm,
}: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <p className="text-[var(--ssb-muted)] mb-5 text-sm sm:text-base font-medium">
        Type &quot;no bags&quot; below to confirm you understand:
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type 'no bags' to confirm"
        className="w-full rounded-lg px-4 py-2.5 text-sm sm:text-base text-[var(--ssb-ink-strong)] bg-white/[0.06] border border-[var(--ssb-border)] focus:ring-2 focus:ring-red-500/50 focus:outline-none placeholder:text-[var(--ssb-faint)] mb-5 transition-colors"
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.toLowerCase().trim() === "no bags") {
            onConfirm();
          }
        }}
        autoFocus
      />
    </>
  );
}

// ─── FeedbackModal ───

export function FeedbackModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
            className="relative bg-[var(--ssb-card)] backdrop-blur-xl border border-[var(--ssb-border)] rounded-2xl p-7 sm:p-8 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 rounded-full p-1.5 text-[var(--ssb-muted)] transition-colors hover:bg-white/[0.08] hover:text-[var(--ssb-ink-strong)]"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── ConfirmationModal ───

export function ConfirmationModal({
  open,
  onClose,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  cancelLabel: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
            className="bg-[var(--ssb-card)] backdrop-blur-xl border border-[var(--ssb-border)] rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-bold text-[var(--ssb-ink-strong)] mb-3">
              {title}
            </h3>
            <p className="text-[var(--ssb-muted)] mb-4 text-sm sm:text-base leading-relaxed">
              {description}
            </p>
            {children}
            <div className={`flex gap-3 ${children ? "mt-5" : "mt-2"}`}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className={`flex-1 ${secondaryButtonBase}`}
              >
                {cancelLabel}
              </motion.button>
              {confirmLabel && onConfirm && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onConfirm}
                  disabled={confirmDisabled}
                  className={`flex-1 ${redButtonBase}`}
                >
                  {confirmLabel}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
