"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { QUESTION_MESSAGES } from "@/app/lib/constants";

const MAX_LEN = 280;
const MIN_LEN = 4;

type Props = {
  eventId: string;
  disabled?: boolean;
  disabledMessage?: string;
};

type FormStatus = "idle" | "submitting" | "success" | "error";

export default function QuestionForm({
  eventId,
  disabled = false,
  disabledMessage,
}: Props) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    const trimmed = value.trim();
    if (trimmed.length < MIN_LEN) {
      setStatus("error");
      setErrorMessage(QUESTION_MESSAGES.ERROR_TOO_SHORT);
      return;
    }
    if (trimmed.length > MAX_LEN) {
      setStatus("error");
      setErrorMessage(QUESTION_MESSAGES.ERROR_TOO_LONG);
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch(`/api/events/${eventId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || QUESTION_MESSAGES.ERROR_GENERIC);
      }
      setStatus("success");
      setValue("");
      router.refresh();
      window.setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : QUESTION_MESSAGES.ERROR_GENERIC,
      );
    }
  };

  const isDisabled = disabled || status === "submitting";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="question"
          className="sr-only"
        >
          Your question
        </label>
        <textarea
          id="question"
          name="question"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isDisabled}
          maxLength={MAX_LEN}
          rows={4}
          placeholder={
            disabled
              ? disabledMessage || "Submissions are closed."
              : "Suggest a question…"
          }
          className="w-full px-4 py-3 rounded-lg border border-zinc-800 bg-[var(--ssb-paper)] text-white placeholder:text-zinc-500
                     focus:outline-none focus:ring-2 focus:ring-[#A80D0C]/30 focus:border-[#A80D0C]
                     transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-zinc-500 mt-1.5 text-right">
          {value.trim().length}/{MAX_LEN}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2 p-3 bg-red-950/30 rounded-md border border-red-900/50"
          >
            <p className="text-sm text-red-300">{errorMessage}</p>
          </motion.div>
        )}
        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2 p-3 bg-green-950/30 rounded-md border border-green-900/50"
          >
            <p className="text-sm text-green-300">{QUESTION_MESSAGES.SUCCESS}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={isDisabled}
        whileHover={isDisabled ? {} : { scale: 1.02 }}
        whileTap={isDisabled ? {} : { scale: 0.98 }}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full
                   bg-[#A80D0C] px-6 py-3.5 font-sans text-sm font-semibold text-white
                   shadow-lg shadow-[#A80D0C]/20
                   transition-colors hover:bg-[#C11211]
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "submitting" ? "Submitting…" : "Submit question"}
      </motion.button>
    </form>
  );
}
