"use client";

import { motion, useReducedMotion } from "motion/react";

type StatChip = { value: string; label: string };

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

export default function SuggestHero({
  topNames,
  totalSuggestions,
  totalVotes,
}: {
  topNames: string[];
  totalSuggestions: number;
  totalVotes: number;
}) {
  const fallback = [
    "Michelle Obama",
    "Steve Carell",
    "Barack Obama",
    "Taylor Swift",
    "Zendaya",
    "Hillary Clinton",
    "Jon Stewart",
    "Rihanna",
    "Lin-Manuel Miranda",
    "Trevor Noah",
    "Malala Yousafzai",
    "Denzel Washington",
  ];

  const names = topNames.length >= 6 ? topNames : [...topNames, ...fallback];
  const half = Math.ceil(names.length / 2);
  const top = names.slice(0, half);
  const bottom = names.slice(half);

  const stats: StatChip[] = [
    {
      value: totalSuggestions.toString(),
      label: totalSuggestions === 1 ? "Name Submitted" : "Names Submitted",
    },
    {
      value: totalVotes.toString(),
      label: totalVotes === 1 ? "Vote Cast" : "Votes Cast",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-zinc-50 dark:bg-black pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div className="absolute inset-0 flex flex-col justify-between py-16 sm:py-20 pointer-events-none">
        <Marquee names={top} direction="left" durationSec={60} />
        <Marquee names={bottom} direction="right" durationSec={75} />
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-zinc-50/60 to-zinc-50 dark:from-black dark:via-black/60 dark:to-black pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 sm:px-12 text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-xs sm:text-sm font-sans uppercase tracking-[0.3em] text-[#A80D0C] mb-6"
        >
          Suggest a Speaker
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="font-serif text-5xl sm:text-7xl lg:text-8xl text-black dark:text-white leading-[0.9] mb-6"
        >
          Who should{" "}
          <span className="text-[#A80D0C] drop-shadow-[0_0_40px_rgba(168,13,12,0.25)]">
            speak
          </span>{" "}
          next?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-2xl mx-auto font-serif text-lg sm:text-xl text-zinc-700 dark:text-zinc-300 mb-10"
        >
          Submit names. Vote on others. Top picks become the leads we chase.
        </motion.p>
      </div>
    </section>
  );
}
