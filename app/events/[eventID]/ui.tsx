"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

// ─── Design token constants ───

export const glassPanel =
  "rounded-xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/70 shadow-lg";

export const redButtonBase =
  "rounded-lg px-6 py-3 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] transition-all hover:bg-[#C11211] hover:shadow-lg hover:shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

export const secondaryButtonBase =
  "rounded-lg border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/[0.06] px-6 py-3 text-sm sm:text-base font-semibold text-zinc-700 dark:text-zinc-200 transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/25 disabled:opacity-50 disabled:cursor-not-allowed";

export const pillBase =
  "inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] backdrop-blur-md border border-black/[0.1] dark:border-white/[0.1] px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm text-zinc-900/90 dark:text-white/90 font-medium";

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

  const isSuccess =
    message?.includes("Successfully") || message?.includes("successfully");

  return createPortal(
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-xl border text-sm font-medium ${
            isSuccess
              ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
              : "bg-red-50/90 dark:bg-red-500/15 border-red-200 dark:border-red-500/25 text-red-700 dark:text-red-300"
          }`}
        >
          <span className="flex items-center gap-2">
            {isSuccess ? (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

// ─── SecondaryButton ───

export function SecondaryButton({
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
      className={`${secondaryButtonBase} w-full ${className ?? ""}`}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner className="border-zinc-300 border-t-zinc-600" />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}

// ─── PriorityBanner ───

export function PriorityBanner({ priorityText }: { priorityText: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/20 px-3.5 py-2 w-full justify-center sm:justify-start">
      <svg
        className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <div className="text-xs sm:text-sm text-amber-700 dark:text-amber-200 font-medium prose prose-sm prose-amber dark:prose-invert prose-p:m-0 prose-p:text-amber-700 dark:prose-p:text-amber-200 prose-a:text-amber-600 dark:prose-a:text-amber-300 prose-a:underline prose-strong:text-amber-800 dark:prose-strong:text-amber-100 max-w-none">
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{priorityText}</ReactMarkdown>
      </div>
    </div>
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
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
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
          className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
            className="bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white mb-3">
              {title}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4 text-sm sm:text-base leading-relaxed">
              {description}
            </p>
            {children}
            <div className={`flex gap-3 ${children ? "mt-5" : "mt-2"}`}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className={`flex-1 px-4 py-2.5 text-sm sm:text-base font-semibold ${secondaryButtonBase}`}
              >
                {cancelLabel}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                disabled={confirmDisabled}
                className="flex-1 px-4 py-2.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] rounded-lg transition-all hover:bg-[#C11211] hover:shadow-lg hover:shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
