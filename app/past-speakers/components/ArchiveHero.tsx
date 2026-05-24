"use client";

import type { CSSProperties } from "react";
import { motion } from "motion/react";

import { ARCHIVE_TITLE_PATHS } from "./archive-title-paths";

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
        className={`archive-marquee-track ${animationClass} inline-flex gap-6 pr-6 font-display text-[clamp(2rem,7vw,6rem)] leading-none text-[var(--ssb-muted)] sm:gap-10 sm:pr-10`}
        style={style}
      >
        {track.map((name, i) => (
          <span key={`${name}-${i}`} className="inline-block">
            {name}
            <span className="mx-6 text-[var(--ssb-accent-text)]">✦</span>
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
          className="archive-title-svg mx-auto block aspect-[1400/310] w-full overflow-visible text-[var(--ssb-accent)]"
          viewBox="0 0 1400 310"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g>
            {ARCHIVE_TITLE_PATHS.map((p) => (
              <path key={p.name} d={p.d} fill="currentColor" />
            ))}
          </g>
        </svg>
      </div>
      <span
        aria-hidden="true"
        className="archive-title-rule absolute inset-x-[9%] bottom-0 h-px origin-center bg-gradient-to-r from-transparent via-[var(--ssb-accent-text)] to-transparent"
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
    <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_top,var(--ssb-accent-soft),transparent_28%),linear-gradient(180deg,var(--ssb-night)_0%,var(--ssb-paper)_100%)] pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="absolute inset-0 flex flex-col justify-between py-16 opacity-80 sm:py-20">
        <Marquee names={top} direction="left" durationSec={top.length * 10} />
        <Marquee
          names={bottom}
          direction="right"
          durationSec={bottom.length * 12.5}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--ssb-night)_0%,var(--ssb-night)_34%,transparent_72%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--ssb-night)] via-transparent to-[var(--ssb-night)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--ssb-night)] via-transparent to-[var(--ssb-night)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 text-center sm:px-12">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 text-xs font-sans uppercase tracking-[0.3em] text-[var(--ssb-accent-text)] sm:text-sm"
        >
          Stanford Speakers Bureau Presents
        </motion.p>

        <ScriptArchiveTitle />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-4 font-display text-xl text-[var(--ssb-ink-strong)] drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)] sm:text-2xl"
        >
          A living record of the voices who have stood on our stage.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mx-auto max-w-2xl text-base font-medium leading-relaxed text-[var(--ssb-ink-strong)] drop-shadow-[0_3px_16px_rgba(0,0,0,0.95)] sm:text-lg"
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
