"use client";

import { motion, useReducedMotion } from "motion/react";

type StatChip = { value: string; label: string };

const STATS: StatChip[] = [
  { value: "2", label: "Nobel Laureates" },
  { value: "6", label: "Years" },
  { value: "31", label: "Speakers" },
  { value: "1", label: "Sitting Mayor" },
];

function Marquee({
  names,
  direction,
  durationSec,
}: {
  names: string[];
  direction: "left" | "right";
  durationSec: number;
}) {
  const reduce = useReducedMotion();
  const from = direction === "left" ? "0%" : "-50%";
  const to = direction === "left" ? "-50%" : "0%";

  // Duplicate the list so the loop is seamless.
  const track = [...names, ...names];

  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden whitespace-nowrap select-none"
    >
      <motion.div
        className="inline-flex gap-10 pr-10 font-serif text-[clamp(2.5rem,7vw,6rem)] leading-none text-zinc-200/80 dark:text-zinc-800/80"
        initial={{ x: from }}
        animate={reduce ? { x: from } : { x: to }}
        transition={
          reduce
            ? undefined
            : {
                duration: durationSec,
                ease: "linear",
                repeat: Infinity,
              }
        }
      >
        {track.map((name, i) => (
          <span key={`${name}-${i}`} className="inline-block">
            {name}
            <span className="mx-6 text-[#A80D0C]/40">✦</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export default function ArchiveHero({
  speakerNames,
}: {
  speakerNames: string[];
}) {
  // Split names between two marquees so each track is shorter and varied.
  const half = Math.ceil(speakerNames.length / 2);
  const top = speakerNames.slice(0, half);
  const bottom = speakerNames.slice(half);

  return (
    <section className="relative overflow-hidden bg-zinc-50 dark:bg-black pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="absolute inset-0 flex flex-col justify-between py-16 sm:py-20">
        <Marquee names={top} direction="left" durationSec={60} />
        <Marquee names={bottom} direction="right" durationSec={75} />
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-zinc-50/60 to-zinc-50 dark:from-black dark:via-black/60 dark:to-black pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 sm:px-12 text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-xs sm:text-sm font-sans uppercase tracking-[0.3em] text-[#A80D0C] mb-6"
        >
          Stanford Speakers Bureau Presents
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="font-serif text-6xl sm:text-8xl lg:text-9xl font-bold text-black dark:text-white leading-[0.9] mb-6"
        >
          The Archive
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="font-serif text-xl sm:text-2xl text-zinc-700 dark:text-zinc-300 mb-4"
        >
          A living record of the voices who have stood on our stage.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="max-w-2xl mx-auto text-base text-zinc-600 dark:text-zinc-400 mb-10"
        >
          Since 1935, Stanford Speakers Bureau has brought Nobel laureates,
          activists, artists, athletes, and provocateurs to Stanford. Every
          speaker below has lit up a room on our campus — scroll, search, and
          relive them.
        </motion.p>

        <motion.ul
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="flex flex-wrap justify-center gap-3 sm:gap-4"
        >
          {STATS.map((stat) => (
            <li
              key={stat.label}
              className="flex items-baseline gap-2 rounded-full border border-zinc-300 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur px-4 py-2"
            >
              <span className="font-serif text-xl sm:text-2xl font-bold text-[#A80D0C]">
                {stat.value}
              </span>
              <span className="text-xs sm:text-sm uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                {stat.label}
              </span>
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
