"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { POPULAR_SPEAKER_NAMES } from "@/app/config/popular-speaker-names";

function useTypewriterCycle(names: string[], reduce: boolean) {
  const [display, setDisplay] = useState(names[0] ?? "");

  useEffect(() => {
    if (!names.length) return;

    if (reduce) {
      let i = 0;
      const id = setInterval(() => {
        i = (i + 1) % names.length;
        setDisplay(names[i]);
      }, 3500);
      return () => clearInterval(id);
    }

    let i = 0;
    let cancelled = false;
    const sleep = (ms: number) =>
      new Promise<void>((res) => {
        const t = setTimeout(res, ms);
        // best-effort: if cancelled mid-sleep, the outer loop exits after sleep resolves
        void t;
      });

    async function loop() {
      while (!cancelled) {
        const name = names[i];
        // Type in (variable per-char delay for natural feel)
        for (let c = 1; c <= name.length && !cancelled; c++) {
          setDisplay(name.slice(0, c));
          await sleep(55 + Math.random() * 35);
        }
        if (cancelled) break;
        await sleep(1400);
        if (cancelled) break;
        // Delete
        for (let c = name.length - 1; c >= 0 && !cancelled; c--) {
          setDisplay(name.slice(0, c));
          await sleep(28);
        }
        if (cancelled) break;
        await sleep(220);
        i = (i + 1) % names.length;
      }
    }
    loop();

    return () => {
      cancelled = true;
    };
  }, [names, reduce]);

  return display;
}

function BlinkingCaret() {
  return (
    <motion.span
      aria-hidden="true"
      animate={{ opacity: [1, 1, 0, 0, 1] }}
      transition={{
        duration: 1.0,
        repeat: Infinity,
        ease: "linear",
        times: [0, 0.5, 0.51, 0.99, 1],
      }}
      className="inline-block w-[0.08em] bg-[#A80D0C] ml-[0.06em] align-middle"
      style={{ height: "0.85em" }}
    />
  );
}

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
        className="inline-flex gap-10 pr-10 font-serif text-[clamp(2.5rem,7vw,6rem)] leading-none text-zinc-600/85"
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
}: {
  topNames: string[];
  totalSuggestions: number;
  totalVotes: number;
}) {
  const names =
    topNames.length >= 6 ? topNames : [...topNames, ...POPULAR_SPEAKER_NAMES];
  const half = Math.ceil(names.length / 2);
  const top = names.slice(0, half);
  const bottom = names.slice(half);

  const reduce = useReducedMotion();
  // Lead with trending user suggestions if we have enough, then fall through to curated picks.
  const cycleNames = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const n of [...topNames, ...POPULAR_SPEAKER_NAMES]) {
      if (!seen.has(n)) {
        seen.add(n);
        merged.push(n);
      }
    }
    return merged.slice(0, 12);
  }, [topNames]);
  const typed = useTypewriterCycle(cycleNames, !!reduce);

  return (
    <section className="relative overflow-hidden bg-[var(--ssb-paper)] pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div className="absolute inset-0 flex flex-col justify-between py-16 sm:py-20 pointer-events-none">
        <Marquee names={top} direction="left" durationSec={60} />
        <Marquee names={bottom} direction="right" durationSec={75} />
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/75 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/25 pointer-events-none" />

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
          className="font-serif text-5xl sm:text-7xl lg:text-8xl text-white leading-[1.05] mb-6"
        >
          <span className="block">What if</span>
          <span
            className="block text-[#A80D0C] drop-shadow-[0_0_40px_rgba(168,13,12,0.25)] whitespace-nowrap"
            aria-live="polite"
          >
            {typed || " "}
            <BlinkingCaret />
          </span>
          <span className="block">spoke at Stanford?</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-2xl mx-auto font-serif text-lg sm:text-xl text-zinc-300 mb-10 font-bold"
        >
          Submit names. Vote on others. Top picks become the leads we chase.
        </motion.p>
      </div>
    </section>
  );
}
