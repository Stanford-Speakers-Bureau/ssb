"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SUGGEST_MESSAGES } from "../lib/constants";

type FormStatus = "idle" | "submitting" | "success" | "error";

export default function SuggestForm() {
  const [speaker, setSpeaker] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!speaker.trim()) {
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
        body: JSON.stringify({ speaker: speaker.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || SUGGEST_MESSAGES.ERROR_GENERIC);
      }

      setStatus("success");
      setSpeaker("");
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 3000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : SUGGEST_MESSAGES.ERROR_GENERIC);
    }
  };

  const isDisabled = status === "submitting";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label 
          htmlFor="speaker" 
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
        >
          Who would you like to see speak?
          <br />
          (1 person per submission preferred)
        </label>
        <textarea
          id="speaker"
          name="speaker"
          rows={3}
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          disabled={isDisabled}
          placeholder="Enter a name"
          className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600
                     bg-white dark:bg-zinc-800 text-black dark:text-white
                     placeholder:text-zinc-400 dark:placeholder:text-zinc-500
                     focus:outline-none focus:ring-2 focus:ring-[#A80D0C] focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all resize-none"
          maxLength={500}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-right">
          {speaker.length}/500
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
          >
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
          </motion.div>
        )}

        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
          >
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-700 dark:text-green-300">{SUGGEST_MESSAGES.SUCCESS}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={isDisabled}
        whileHover={isDisabled ? {} : { scale: 1.02 }}
        whileTap={isDisabled ? {} : { scale: 0.98 }}
        className="w-full py-3 px-6 rounded font-semibold text-white
                   bg-[#A80D0C] hover:bg-[#8a0b0a]
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all shadow-md hover:shadow-lg
                   flex items-center justify-center gap-2"
      >
        {status === "submitting" ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Submitting...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span>Submit Suggestion</span>
          </>
        )}
      </motion.button>
    </form>
  );
}
