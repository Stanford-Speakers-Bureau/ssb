"use client";

import type { CSSProperties } from "react";
import { motion } from "motion/react";

import { ARCHIVE_TITLE_PATHS } from "./archive-title-paths";

const TITLE_RED = "#A80D0C";

function Marquee({
  names,
  direction,
  durationSec,
}: {
  names: string[];
  direction: "left" | "right";
  durationSec: number;
}) {
  // Duplicate the list so the loop is seamless.
  const track = [...names, ...names];
  const animationClass =
    direction === "left"
      ? "archive-marquee-track-left"
      : "archive-marquee-track-right";
  const style = {
    "--archive-marquee-duration": `${Math.max(durationSec, 32)}s`,
    "--archive-marquee-start": direction === "left" ? "0%" : "-50%",
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden whitespace-nowrap select-none"
    >
      <div
        className={`archive-marquee-track ${animationClass} inline-flex gap-6 pr-6 font-serif text-[clamp(2rem,7vw,6rem)] leading-none text-[#bba89d]/60 sm:gap-10 sm:pr-10`}
        style={style}
      >
        {track.map((name, i) => (
          <span key={`${name}-${i}`} className="inline-block">
            {name}
            <span className="mx-6 text-[#f08f74]/44">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ScriptArchiveTitle() {
  return (
    <h1
      aria-label="The Archive"
      className="relative mx-auto mb-8 w-full max-w-5xl px-0"
    >
      <div className="archive-title-reveal relative mx-auto overflow-hidden">
        <svg
          aria-hidden="true"
          className="archive-title-svg mx-auto block aspect-[1400/310] w-full overflow-visible"
          viewBox="0 0 1400 310"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g>
            {ARCHIVE_TITLE_PATHS.map((p) => (
              <path key={p.name} d={p.d} fill={TITLE_RED} />
            ))}
          </g>
        </svg>
      </div>
      <span
        aria-hidden="true"
        className="archive-title-rule absolute inset-x-[9%] bottom-0 h-px origin-center bg-gradient-to-r from-transparent via-[#f08f74]/80 to-transparent"
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
