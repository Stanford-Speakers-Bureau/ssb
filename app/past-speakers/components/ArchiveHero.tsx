"use client";

import { motion, useReducedMotion } from "motion/react";

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
        className="inline-flex gap-10 pr-10 font-serif text-[clamp(2.5rem,7vw,6rem)] leading-none text-[#bba89d]/82"
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
            <span className="mx-6 text-[#f08f74]/44">✦</span>
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
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(240,143,116,0.16),transparent_28%),linear-gradient(180deg,#1c1513_0%,#130f0e_100%)] pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="absolute inset-0 flex flex-col justify-between py-16 sm:py-20">
        <Marquee names={top} direction="left" durationSec={top.length * 10} />
        <Marquee names={bottom} direction="right" durationSec={bottom.length * 12.5} />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#120f0e]/36 via-transparent to-[#120f0e]/72" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#120f0e]/20 via-transparent to-[#120f0e]/20" />

      <div className="relative max-w-6xl mx-auto px-6 sm:px-12 text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 text-xs font-sans uppercase tracking-[0.3em] text-[#f19a80] sm:text-sm"
        >
          Stanford Speakers Bureau Presents
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="font-serif text-6xl sm:text-8xl lg:text-9xl text-white leading-[0.9] mb-6"
        >
          The Archive
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-4 font-serif text-xl text-[#f4e4d7] sm:text-2xl"
        >
          A living record of the voices who have stood on our stage.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mx-auto max-w-2xl text-base text-[#d4c0b2]"
        >
          Since 1935, Stanford Speakers Bureau has brought Nobel laureates,
          activists, artists, athletes, and provocateurs to Stanford. Every
          speaker below has lit up a room on our campus. Scroll, search, and
          relive them.
        </motion.p>
      </div>
    </section>
  );
}
