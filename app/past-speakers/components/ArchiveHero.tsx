"use client";

import { motion, useReducedMotion } from "motion/react";

import { ARCHIVE_TITLE_PATHS } from "./archive-title-paths";

const TITLE_REVEAL_EASE = "linear" as const;
const TITLE_RED = "#A80D0C";
const MASK_STROKE_WIDTH = 60;

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
        className="inline-flex gap-10 pr-10 font-serif text-[clamp(2.5rem,7vw,6rem)] leading-none text-[#bba89d]/60"
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

function ScriptArchiveTitle() {
  const reduce = useReducedMotion();

  return (
    <h1
      aria-label="The Archive"
      className="relative mx-auto mb-8 w-full max-w-5xl px-0"
    >
      <svg
        aria-hidden="true"
        className="mx-auto block aspect-[1400/310] w-full overflow-visible drop-shadow-[0_16px_34px_rgba(0,0,0,0.7)]"
        viewBox="0 0 1400 310"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter
            id="archive-title-glow"
            x="-10%"
            y="-30%"
            width="120%"
            height="160%"
          >
            <feDropShadow
              dx="0"
              dy="10"
              stdDeviation="10"
              floodColor="#000000"
              floodOpacity="0.55"
            />
          </filter>
          {ARCHIVE_TITLE_PATHS.map((p) => (
            <mask
              key={p.name}
              id={`archive-mask-${p.name}`}
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="1400"
              height="310"
            >
              <motion.path
                d={p.d}
                fill="none"
                stroke="white"
                strokeWidth={MASK_STROKE_WIDTH}
                strokeLinecap="butt"
                strokeLinejoin="round"
                initial={{ pathLength: reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  delay: reduce ? 0 : p.delay,
                  duration: reduce ? 0 : p.duration,
                  ease: TITLE_REVEAL_EASE,
                }}
              />
            </mask>
          ))}
        </defs>

        <g filter="url(#archive-title-glow)">
          {ARCHIVE_TITLE_PATHS.map((p) => (
            <path
              key={p.name}
              d={p.d}
              fill={TITLE_RED}
              mask={`url(#archive-mask-${p.name})`}
            />
          ))}
        </g>
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-x-[9%] bottom-0 h-px bg-gradient-to-r from-transparent via-[#f08f74]/80 to-transparent"
      />
    </h1>
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
    <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_top,rgba(240,143,116,0.16),transparent_28%),linear-gradient(180deg,#1c1513_0%,#130f0e_100%)] pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="absolute inset-0 flex flex-col justify-between py-16 opacity-80 sm:py-20">
        <Marquee names={top} direction="left" durationSec={top.length * 10} />
        <Marquee
          names={bottom}
          direction="right"
          durationSec={bottom.length * 12.5}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(18,15,14,0.95)_0%,rgba(18,15,14,0.76)_34%,rgba(18,15,14,0.22)_63%,transparent_80%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#120f0e]/64 via-transparent to-[#120f0e]/84" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#120f0e]/36 via-transparent to-[#120f0e]/36" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 text-center sm:px-12">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 text-xs font-sans uppercase tracking-[0.3em] text-[#f19a80] sm:text-sm"
        >
          Stanford Speakers Bureau Presents
        </motion.p>

        <ScriptArchiveTitle />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-4 font-serif text-xl text-[#fff3e8] drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)] sm:text-2xl"
        >
          A living record of the voices who have stood on our stage.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mx-auto max-w-2xl text-base font-medium leading-relaxed text-[#fff8f0] drop-shadow-[0_3px_16px_rgba(0,0,0,0.95)] sm:text-lg"
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
