"use client";

import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef } from "react";

const MAILING_LIST_URL =
  "https://mailman.stanford.edu/mailman/listinfo/ssb-announce";
const CO_PRES_EMAIL = "ajoshi17@stanford.edu,anishan@stanford.edu";

const MotionLink = motion.create(Link);
const MotionA = motion.a;

const EASE = [0.43, 0.13, 0.23, 0.96] as const;

function HeroBackdrop({ parallaxY }: { parallaxY: MotionValue<string> }) {
  const reduce = useReducedMotion();
  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute left-0 right-0 -top-[25%] h-[150%] opacity-60"
        initial={{ scale: 1.1 }}
        animate={reduce ? { scale: 1.1 } : { scale: 1.0 }}
        transition={{
          duration: 30,
          ease: "linear",
          repeat: Infinity,
          repeatType: "reverse",
        }}
        style={{ y: parallaxY }}
      >
        <Image
          src="/meeting.JPG"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/75 to-black" />
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[95vw] max-w-[720px] max-h-[720px] rounded-full bg-[#A80D0C]/20 blur-3xl pointer-events-none"
      />
    </div>
  );
}

function JoinHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const parallaxY = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? ["0%", "0%"] : ["0%", "18%"],
  );

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-[88vh] flex items-center justify-center overflow-hidden bg-[var(--ssb-paper)]"
    >
      <HeroBackdrop parallaxY={parallaxY} />

      <div className="relative z-10 flex flex-col items-center px-6 sm:px-12 text-center max-w-4xl mx-auto pt-28 pb-20 sm:pt-36 sm:pb-24">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="inline-block mb-6 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-5 py-2 text-xs sm:text-sm font-sans uppercase tracking-[0.3em] text-white/80"
        >
          Join the Team
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
          className="font-serif text-4xl sm:text-5xl md:text-7xl lg:text-8xl text-white leading-[0.92] mb-6"
        >
          Decide who{" "}
          <span className="text-[#A80D0C] drop-shadow-[0_0_40px_rgba(168,13,12,0.35)]">
            speaks at Stanford
          </span>{" "}
          next.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: EASE }}
          className="font-sans text-base sm:text-lg md:text-xl text-zinc-300 max-w-2xl leading-relaxed mb-10"
        >
          SSB is a student-run board, undergrad and grad, that
          meets every Monday, reaches out to the biggest names, and puts on the events.
          Applications open every fall.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: EASE }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <MotionA
            href={MAILING_LIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-full px-8 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] shadow-lg shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211]"
          >
            Get notified when apps open
          </MotionA>
          <MotionA
            href={`mailto:${CO_PRES_EMAIL}`}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-full px-8 py-3.5 text-sm sm:text-base font-semibold text-white border border-white/30 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Email the Co-Presidents
          </MotionA>
        </motion.div>
      </div>
    </section>
  );
}

const ESSENTIALS = [
  {
    label: "Open to",
    value: "Undergrad + Grad",
    detail: "Any year, any major. We want range.",
  },
  {
    label: "Meets",
    value: "Every Monday",
    detail: "On campus, during the academic year.",
  },
  {
    label: "What we do",
    value: "Book Big Speakers",
    detail: "Plan events end-to-end, from pitch to stage.",
  },
  {
    label: "Applications",
    value: "Every Fall",
    detail: "Get on the list and we'll let you know.",
  },
];

function EssentialsSection() {
  return (
    <section className="relative bg-[var(--ssb-paper)] border-t border-zinc-900 py-20 sm:py-28 px-6 sm:px-12">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12 sm:mb-16"
        >
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
            The essentials
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-white leading-[0.95] max-w-3xl">
            The short version.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-900 border-y border-zinc-900">
          {ESSENTIALS.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
              className="p-7 sm:p-8"
            >
              <p className="text-[0.7rem] uppercase tracking-[0.25em] text-[#A80D0C] mb-4 font-semibold">
                {item.label}
              </p>
              <p className="font-serif text-2xl sm:text-3xl text-white leading-tight mb-3">
                {item.value}
              </p>
              <p className="font-sans text-sm text-zinc-400 leading-relaxed">
                {item.detail}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const ACTIVITIES = [
  {
    number: "01",
    title: "Pitch the people you want to hear.",
    body: "Every Monday, members bring names to the table. If you can make the case, the room backs you.",
  },
  {
    number: "02",
    title: "Reach out to agents, managers, and teams.",
    body: "You'll learn to land speakers that students dream of. You'll hear back more than you'd think.",
  },
  {
    number: "03",
    title: "Plan the show, end to end.",
    body: "Book venues, negotiate fees, handle logistics, host the speaker the day of. Real ownership, not busywork.",
  },
  {
    number: "04",
    title: "Put it on stage.",
    body: "Run the event in front of a packed Stanford audience! Then do it again next month.",
  },
];

function WhatYouDoSection() {
  return (
    <section className="relative bg-zinc-950 border-t border-zinc-900 py-20 sm:py-28 px-6 sm:px-12 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-14 sm:mb-20"
        >
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
            On the board
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-white leading-[0.95] max-w-3xl">
            What members actually do.
          </h2>
        </motion.div>

        <div>
          {ACTIVITIES.map((a, i) => (
            <motion.div
              key={a.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
              className="grid grid-cols-[auto_1fr] gap-5 sm:gap-10 items-start border-t border-zinc-900 py-8 sm:py-10 last:border-b"
            >
              <span className="font-serif text-4xl sm:text-6xl text-[#A80D0C] leading-none select-none tabular-nums">
                {a.number}
              </span>
              <div>
                <h3 className="font-serif text-2xl sm:text-4xl text-white leading-[1.05] mb-3">
                  {a.title}
                </h3>
                <p className="font-sans text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl">
                  {a.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <section
      ref={ref}
      className="relative bg-[var(--ssb-paper)] border-t border-zinc-900 py-20 sm:py-28 px-6 sm:px-12 overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] max-w-[540px] max-h-[540px] rounded-full bg-[#A80D0C]/10 blur-3xl pointer-events-none"
      />
      <div className="relative max-w-3xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-4"
        >
          Stay in the loop
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="font-serif text-3xl sm:text-5xl text-white leading-[0.95] mb-5"
        >
          We&rsquo;ll tell you the moment applications open.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="font-sans text-base sm:text-lg text-zinc-300 max-w-xl mx-auto leading-relaxed mb-10"
        >
          In the meantime, come to an event, suggest a speaker, and we&rsquo;ll
          see you in the fall.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <MotionA
            href={MAILING_LIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#A80D0C] px-7 py-3 text-sm font-semibold text-white shadow-md shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211]"
          >
            Join the Mailing List
          </MotionA>
          <MotionLink
            href="/suggest"
            prefetch={false}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 backdrop-blur-sm px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Suggest a Speaker
          </MotionLink>
          <MotionLink
            href="/upcoming-speakers"
            prefetch={false}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 backdrop-blur-sm px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Upcoming Events
          </MotionLink>
        </motion.div>
      </div>
    </section>
  );
}

export default function JoinClient() {
  return (
    <main className="flex min-h-screen flex-col bg-[var(--ssb-paper)]">
      <JoinHero />
      <EssentialsSection />
      <WhatYouDoSection />
      <FinalCta />
    </main>
  );
}
