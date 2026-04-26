"use client";

import { motion } from "motion/react";

const EASE = [0.43, 0.13, 0.23, 0.96] as const;

type UpcomingHeroProps = {
  hasEvents: boolean;
};

export default function UpcomingHero({ hasEvents }: UpcomingHeroProps) {
  return (
    <section className="relative w-full overflow-hidden bg-[var(--ssb-night)] pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,240,224,0.14),transparent_30%),radial-gradient(circle_at_18%_22%,rgba(219,76,58,0.22),transparent_34%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#130e0d]/40 via-transparent to-[var(--ssb-paper)]"
      />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 text-center sm:px-12">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="mb-6 inline-block rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-sans uppercase tracking-[0.3em] text-white/85 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-md sm:text-sm"
        >
          {hasEvents ? "On the calendar" : "Between events"}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="mb-8 max-w-4xl font-serif text-4xl leading-[1.0] tracking-[-0.02em] text-white drop-shadow-[0_10px_28px_rgba(0,0,0,0.5)] sm:text-6xl lg:text-7xl"
          style={{
            textShadow:
              "0 8px 24px rgba(0, 0, 0, 0.38), 0 2px 6px rgba(0, 0, 0, 0.38)",
          }}
        >
          {hasEvents ? (
            <>
              Up{" "}
              <span className="bg-gradient-to-r from-[#f28c73] via-[#e75b45] to-[#c62720] bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(219,76,58,0.32)]">
                next
              </span>{" "}
              on the Speakers Bureau stage.
            </>
          ) : (
            <>Nothing on the calendar yet.</>
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
          className="max-w-2xl font-sans text-base leading-relaxed text-[#f5e8dc]/85 sm:text-lg"
        >
          {hasEvents
            ? "We're so excited to welcome you to our next event! Remember to join our mailing list to stay in the loop."
            : "We're between speakers. Drop a name on the suggest list or join the mailing list, and you'll be the first to know when the next one drops."}
        </motion.p>
      </div>
    </section>
  );
}
