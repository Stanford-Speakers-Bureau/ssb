"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { HERO_BACKGROUND_IMAGES } from "@/app/config/home-hero";

const MotionLink = motion.create(Link);

const ROTATION_INTERVAL_MS = 5500;
const STATIC_IMAGE_SRC = "/speakers/bernie.jpg";
const STATIC_IMAGE_INDEX = Math.max(
  0,
  HERO_BACKGROUND_IMAGES.indexOf(STATIC_IMAGE_SRC),
);

function HeroBackground() {
  const [index, setIndex] = useState(STATIC_IMAGE_INDEX);
  const [rotateEnabled, setRotateEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setRotateEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!rotateEnabled) {
      setIndex(STATIC_IMAGE_INDEX);
      return;
    }
    if (HERO_BACKGROUND_IMAGES.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % HERO_BACKGROUND_IMAGES.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [rotateEnabled]);

  const activeSrc = HERO_BACKGROUND_IMAGES[index] ?? HERO_BACKGROUND_IMAGES[0];

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.div
          key={activeSrc}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1.0 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.6, ease: [0.4, 0, 0.2, 1] },
            scale: { duration: ROTATION_INTERVAL_MS / 1000 + 1.6, ease: "linear" },
          }}
          className="absolute inset-0"
        >
          <Image
            src={activeSrc}
            alt=""
            fill
            priority={activeSrc === STATIC_IMAGE_SRC}
            quality={90}
            className="object-cover object-center"
            sizes="100vw"
          />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-[#100c0b]/58 via-[#100c0b]/36 to-[#100c0b]/82" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#100c0b]/54 via-[#100c0b]/18 to-[#100c0b]/58" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,9,8,0.18)_0%,rgba(14,9,8,0.26)_46%,rgba(14,9,8,0.64)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[var(--ssb-paper)] to-transparent" />
    </div>
  );
}

const EASE = [0.43, 0.13, 0.23, 0.96] as const;

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--ssb-night)] pt-20">
      <HeroBackground />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/54 to-transparent"
      />
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-10 text-center sm:px-12">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="mb-6 inline-block rounded-full border border-[#f5d5c8]/28 bg-[#130e0d]/58 px-5 py-2 text-xs font-sans uppercase tracking-[0.28em] text-[#fff5ee] shadow-[0_12px_34px_rgba(0,0,0,0.3)] backdrop-blur-md sm:text-sm"
        >
          Since 1935
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="mb-8 max-w-4xl font-serif text-5xl leading-[0.94] text-[#fff8f1] drop-shadow-[0_16px_42px_rgba(0,0,0,0.72)] sm:text-6xl md:text-7xl lg:text-8xl"
          style={{
            WebkitTextStroke: "0.4px rgba(18, 12, 11, 0.58)",
            textShadow:
              "0 16px 38px rgba(0, 0, 0, 0.62), 0 3px 8px rgba(0, 0, 0, 0.5)",
          }}
        >
          Stanford <span className="text-[#ffaf9d]">Speakers</span> Bureau
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: EASE }}
          className="mb-10 max-w-2xl font-sans text-base leading-relaxed text-[#fff1e8] drop-shadow-[0_8px_24px_rgba(0,0,0,0.58)] sm:text-lg md:text-xl"
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
            href="/subscribe"
            prefetch={false}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-full bg-[#d74331] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_20px_48px_rgba(123,19,15,0.46)] transition-all hover:-translate-y-0.5 hover:bg-[#ef624b] sm:text-base"
          >
            Join the Mailing List
          </MotionLink>
          <MotionLink
            href="/suggest"
            prefetch={false}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-full border border-[#f2ded0]/70 bg-[#fff8f1] px-8 py-3.5 text-sm font-semibold text-[#1c1614] shadow-[0_16px_42px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-0.5 hover:bg-white sm:text-base"
          >
            Suggest a Speaker
          </MotionLink>
        </motion.div>
      </div>
    </section>
  );
}
