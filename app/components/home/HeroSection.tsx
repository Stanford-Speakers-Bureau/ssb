"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

const MotionLink = motion.create(Link);

const MOSAIC_IMAGES = [
  { src: "/speakers/malala-yousafzai.jpg", alt: "Malala Yousafzai" },
  { src: "/speakers/hasan-minhaj.jpg", alt: "Hasan Minhaj" },
  { src: "/speakers/mark-rober.jpeg", alt: "Mark Rober" },
  { src: "/speakers/jojo-siwa.jpg", alt: "JoJo Siwa" },
  { src: "/speakers/john-green.jpg", alt: "John Green" },
];

function PhotoMosaic() {
  const reduce = useReducedMotion();
  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-1 opacity-35 dark:opacity-25"
        initial={{ scale: 1.1 }}
        animate={reduce ? { scale: 1.1 } : { scale: 1.0 }}
        transition={{ duration: 30, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
      >
        {MOSAIC_IMAGES.map((img, i) => (
          <div
            key={img.src}
            className={`relative overflow-hidden ${
              i === 0 ? "row-span-2" : ""
            }`}
          >
            <Image
              src={img.src}
              alt={`${img.alt} at Stanford Speakers Bureau`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 33vw"
              priority={i < 2}
            />
          </div>
        ))}
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/75 to-black/90" />
    </div>
  );
}

const EASE = [0.43, 0.13, 0.23, 0.96] as const;

export default function HeroSection() {
  const headingWords = ["Stanford", "Speakers", "Bureau"];

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
      <PhotoMosaic />

      <div className="relative z-10 flex flex-col items-center px-6 sm:px-12 text-center max-w-5xl mx-auto">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="inline-block mb-6 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-5 py-2 text-xs sm:text-sm font-sans uppercase tracking-[0.3em] text-white/80"
        >
          Since 1935
        </motion.span>

        <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-9xl leading-[0.9] mb-8">
          {headingWords.map((word, wordIndex) => (
            <motion.span
              key={wordIndex}
              className="inline-block mr-4 sm:mr-6 last:mr-0"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: { delayChildren: wordIndex * 0.15 },
                },
              }}
            >
              {word.split("").map((char, charIndex) => (
                <motion.span
                  key={charIndex}
                  className={`inline-block ${
                    wordIndex === 1
                      ? "text-[#A80D0C] drop-shadow-[0_0_40px_rgba(168,13,12,0.4)]"
                      : "text-white"
                  }`}
                  variants={{
                    hidden: { opacity: 0, y: 50, rotateX: -90 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      rotateX: 0,
                      transition: { duration: 0.6, ease: EASE },
                    },
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.span>
          ))}
        </h1>

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
