"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { SUGGEST_MESSAGES } from "@/app/lib/constants";

type FormStatus = "idle" | "submitting" | "success" | "error";

export default function SuggestForm() {
  const [pills, setPills] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInput(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      const trimmed = currentInput.trim();
      if (trimmed && !pills.includes(trimmed)) {
        setPills([...pills, trimmed]);
        setCurrentInput("");
      } else if (trimmed === "") {
        return;
      }
    } else if (
      e.key === "Backspace" &&
      currentInput === "" &&
      pills.length > 0
    ) {
      setPills(pills.slice(0, -1));
    }
  };

  const removePill = (index: number) => {
    setPills(pills.filter((_, i) => i !== index));
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const allSuggestions = [
      ...pills,
      ...(currentInput.trim() ? [currentInput.trim()] : []),
    ];

    if (allSuggestions.length === 0) {
      setErrorMessage("Please enter a speaker name");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker: allSuggestions.join(", ") }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || SUGGEST_MESSAGES.ERROR_GENERIC);
      }

      setStatus("success");
      setPills([]);
      setCurrentInput("");
      router.refresh();

      setTimeout(() => {
        setStatus("idle");
      }, 3000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : SUGGEST_MESSAGES.ERROR_GENERIC,
      );
    }
  };

  const isDisabled = status === "submitting";

  const allSuggestions = [
    ...pills,
    ...(currentInput.trim() ? [currentInput.trim()] : []),
  ];
  const totalLength = allSuggestions.join(", ").length;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="speaker"
          className="block font-sans text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-3"
        >
          Who would you like to see?{" "}
          <span className="normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
            (comma or enter to add)
          </span>
        </label>
        <div
          ref={containerRef}
          onClick={() => inputRef.current?.focus()}
          className="w-full min-h-[92px] px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-800
                     bg-white dark:bg-black
                     focus-within:outline-none focus-within:ring-2 focus-within:ring-[#A80D0C]/30 focus-within:border-[#A80D0C]
                     transition-all flex flex-wrap gap-2 items-start cursor-text"
        >
          <AnimatePresence mode="popLayout">
            {pills.map((pill, index) => (
              <motion.div
                key={`${pill}-${index}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full
                           bg-[#A80D0C]/10 text-[#A80D0C] text-sm font-medium ring-1 ring-[#A80D0C]/20"
              >
                <span>{pill}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePill(index);
                  }}
                  className="hover:bg-[#A80D0C]/20 rounded-full p-0.5 transition-colors
                             focus:outline-none focus:ring-2 focus:ring-[#A80D0C]/40"
                  aria-label={`Remove ${pill}`}
                >
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <input
            ref={inputRef}
            id="speaker"
            name="speaker"
            type="text"
            value={currentInput}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            disabled={isDisabled}
            placeholder={pills.length === 0 ? "Enter a name" : ""}
            className="flex-1 min-w-[120px] bg-transparent border-none outline-none
                       text-zinc-900 dark:text-white
                       placeholder:text-zinc-400 dark:placeholder:text-zinc-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
            maxLength={500}
          />
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5 text-right">
          {totalLength}/500
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-900/50"
          >
            <svg
              width="18"
              height="18"
              className="text-red-500 shrink-0 translate-y-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-300">
              {errorMessage}
            </p>
          </motion.div>
        )}

        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-900/50"
          >
            <svg
              width="18"
              height="18"
              className="text-green-600 shrink-0 translate-y-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-green-700 dark:text-green-300">
              {SUGGEST_MESSAGES.SUCCESS}
            </p>
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
        {status === "submitting" ? (
          <>
            <svg
              className="animate-spin w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Submitting&hellip;</span>
          </>
        ) : (
          <>
            <span>Submit suggestion</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </>
        )}
      </motion.button>
    </form>
  );
}
