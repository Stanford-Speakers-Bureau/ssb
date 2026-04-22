"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { HERO_BACKGROUND_IMAGES } from "@/app/config/home-hero";

const MotionLink = motion.create(Link);

const ROW_TOP = HERO_BACKGROUND_IMAGES;
const ROW_BOTTOM = [...HERO_BACKGROUND_IMAGES].reverse();

function PhotoRow({
  photos,
  direction,
  durationSec,
}: {
  photos: string[];
  direction: "left" | "right";
  durationSec: number;
}) {
  const reduce = useReducedMotion();
  const from = direction === "left" ? "0%" : "-50%";
  const to = direction === "left" ? "-50%" : "0%";
  const track = [...photos, ...photos];

  return (
    <div aria-hidden="true" className="relative overflow-hidden h-1/2">
      <motion.div
        className="flex h-full gap-3"
        initial={{ x: from }}
        animate={reduce ? { x: from } : { x: to }}
        transition={
          reduce
            ? undefined
            : { duration: durationSec, ease: "linear", repeat: Infinity }
        }
      >
        {track.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative h-full aspect-[4/5] shrink-0 overflow-hidden rounded"
          >
            <Image
              src={src}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 40vw, 20vw"
              priority={i < 2}
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function PhotoMosaic() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 flex flex-col gap-3 py-6 opacity-60 dark:opacity-50">
        <PhotoRow photos={ROW_TOP} direction="left" durationSec={60} />
        <PhotoRow photos={ROW_BOTTOM} direction="right" durationSec={75} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/80 to-black/95" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
    </div>
  );
}

const EASE = [0.43, 0.13, 0.23, 0.96] as const;

export default function HeroSection() {
  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
      <PhotoMosaic />

      <div className="relative z-10 flex flex-col items-center px-6 sm:px-12 text-center max-w-4xl mx-auto">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="inline-block mb-6 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-5 py-2 text-xs sm:text-sm font-sans uppercase tracking-[0.3em] text-white/80"
        >
          Since 1935
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.0] mb-8 text-white"
        >
          Stanford{" "}
          <span className="text-[#A80D0C] drop-shadow-[0_0_30px_rgba(168,13,12,0.35)]">
            Speakers
          </span>{" "}
          Bureau
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: EASE }}
          className="font-sans text-base sm:text-lg md:text-xl text-zinc-300 max-w-2xl leading-relaxed mb-10"
        >
          Stanford&rsquo;s largest student organization sponsor of speaking
          events. We bring Nobel laureates, artists, leaders, and creators to
          campus — and have since 1935.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.75, ease: EASE }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <MotionLink
            href="https://mailman.stanford.edu/mailman/listinfo/ssb-announce"
            prefetch={false}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-full px-8 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] shadow-lg shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211]"
          >
            Join the Mailing List
          </MotionLink>
          <MotionLink
            href="/suggest"
            prefetch={false}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-full px-8 py-3.5 text-sm sm:text-base font-semibold text-white border border-white/30 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Suggest a Speaker
          </MotionLink>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2 text-white/40"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] font-sans">
            Scroll
          </span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}
