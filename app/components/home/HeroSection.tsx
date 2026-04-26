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
      <div className="absolute inset-0 flex flex-col gap-3 py-6 opacity-70">
        <PhotoRow photos={ROW_TOP} direction="left" durationSec={60} />
        <PhotoRow photos={ROW_BOTTOM} direction="right" durationSec={80} />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,240,224,0.18),transparent_28%),radial-gradient(circle_at_18%_22%,rgba(219,76,58,0.22),transparent_34%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#130e0d]/50 via-[#130e0d]/38 to-[#130e0d]/84" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#130e0d]/40 via-transparent to-[#130e0d]/32" />
    </div>
  );
}

const EASE = [0.43, 0.13, 0.23, 0.96] as const;

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--ssb-night)]">
      <PhotoMosaic />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/30 to-transparent"
      />
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 text-center sm:px-12">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="mb-6 inline-block rounded-full border border-white/20 bg-white/12 px-5 py-2 text-xs font-sans uppercase tracking-[0.3em] text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.15)] backdrop-blur-md sm:text-sm"
        >
          Since 1935
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="mb-8 max-w-4xl font-serif text-4xl leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_10px_28px_rgba(0,0,0,0.5)] sm:text-5xl md:text-6xl lg:text-7xl"
          style={{
            WebkitTextStroke: "0.6px rgba(14, 10, 10, 0.45)",
            textShadow:
              "0 8px 24px rgba(0, 0, 0, 0.38), 0 2px 6px rgba(0, 0, 0, 0.38)",
          }}
        >
          Stanford{" "}
          <span className="bg-gradient-to-r from-[#f28c73] via-[#e75b45] to-[#c62720] bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(219,76,58,0.32)]">
            Speakers
          </span>{" "}
          Bureau
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: EASE }}
          className="mb-10 max-w-2xl font-sans text-base leading-relaxed text-[#f5e8dc]/88 sm:text-lg md:text-xl"
        >
          Stanford&rsquo;s largest student organization sponsor of speaking
          events. We bring Nobel laureates, artists, leaders, and creators to
          campus, and have since 1935.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.75, ease: EASE }}
          className="flex flex-col gap-4 sm:flex-row"
        >
          <MotionLink
            href="https://mailman.stanford.edu/mailman/listinfo/ssb-announce"
            prefetch={false}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-full bg-gradient-to-r from-[#b51f1a] to-[#db4c3a] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(181,31,26,0.35)] transition-all hover:-translate-y-0.5 hover:from-[#c62720] hover:to-[#eb6a56] sm:text-base"
          >
            Join the Mailing List
          </MotionLink>
          <MotionLink
            href="/suggest"
            prefetch={false}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-full border border-[#f2ded0]/50 bg-[#fff8f1] px-8 py-3.5 text-sm font-semibold text-[#1c1614] shadow-[0_12px_35px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 hover:bg-white sm:text-base"
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
          className="flex flex-col items-center gap-2 text-white/60"
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
