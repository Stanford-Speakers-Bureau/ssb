"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { LEADERSHIP, DIRECTORS, type TeamMember } from "./members";

const MotionLink = motion.create(Link);

const EASE = [0.43, 0.13, 0.23, 0.96] as const;

function TeamMosaic() {
  const reduce = useReducedMotion();
  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute inset-0 opacity-45 dark:opacity-35"
        initial={{ scale: 1.1 }}
        animate={reduce ? { scale: 1.1 } : { scale: 1.0 }}
        transition={{
          duration: 30,
          ease: "linear",
          repeat: Infinity,
          repeatType: "reverse",
        }}
      >
        <Image
          src="/team.jpg"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/95" />
    </div>
  );
}

function TeamHero() {
  return (
    <section className="relative w-full min-h-[85vh] flex items-center justify-center overflow-hidden bg-black">
      <TeamMosaic />

      <div className="relative z-10 flex flex-col items-center px-6 sm:px-12 text-center max-w-4xl mx-auto">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="inline-block mb-6 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-5 py-2 text-xs sm:text-sm font-sans uppercase tracking-[0.3em] text-white/80"
        >
          Our Team
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
          className="font-serif text-5xl sm:text-7xl md:text-8xl text-white leading-[0.92] mb-6"
        >
          The students who{" "}
          <span className="text-[#A80D0C] drop-shadow-[0_0_40px_rgba(168,13,12,0.35)]">
            make this
          </span>{" "}
          happen.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
          className="font-sans text-base sm:text-lg md:text-xl text-zinc-300 max-w-2xl leading-relaxed mb-10"
        >
          Stanford Speakers Bureau is run by an all-student board. We meet
          weekly to decide who should come to campus, secure the funding, and
          put on the shows.
        </motion.p>
      </div>
    </section>
  );
}

function LeaderCard({
  member,
  index,
}: {
  member: TeamMember;
  index: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.12, ease: "easeOut" }}
      className="group"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg ring-1 ring-zinc-900 bg-zinc-950 mb-5">
        <Image
          src={member.image}
          alt={member.name}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      <h3 className="font-serif text-2xl sm:text-3xl text-white mb-1 leading-tight">
        {member.name}
      </h3>
      <p className="text-xs uppercase tracking-[0.2em] text-[#A80D0C] mb-3 font-semibold">
        {member.role}
      </p>
      {member.bio && (
        <p className="font-sans text-sm text-zinc-400 leading-relaxed mb-3">
          {member.bio}
        </p>
      )}
      {member.email && (
        <a
          href={`mailto:${member.email}`}
          className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-zinc-500 hover:text-[#A80D0C] transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          {member.email}
        </a>
      )}
    </motion.div>
  );
}

function LeadershipSection() {
  return (
    <section className="bg-black py-20 sm:py-28 px-6 sm:px-12 border-t border-zinc-900">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 sm:mb-16">
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
            Leadership
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-white leading-[0.95] max-w-3xl">
            The people who set the vision for the year.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
          {LEADERSHIP.map((member, i) => (
            <LeaderCard key={member.name} member={member} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DirectorCard({
  member,
  index,
}: {
  member: TeamMember;
  index: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-lg"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-900">
        <Image
          src={member.image}
          alt={member.name}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <h3 className="font-serif text-lg sm:text-xl text-white leading-tight mb-1">
            {member.name}
          </h3>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#A80D0C] font-semibold">
            {member.role}
          </p>
        </div>
      </div>
      {member.email && (
        <a
          href={`mailto:${member.email}`}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-zinc-500 hover:text-[#A80D0C] transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          {member.email}
        </a>
      )}
    </motion.div>
  );
}

function DirectorsSection() {
  return (
    <section className="bg-zinc-950 py-20 sm:py-28 px-6 sm:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 sm:mb-16">
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
            Directors
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-white leading-[0.95] max-w-3xl">
            The folks owning the functions that make events happen.
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 sm:gap-6">
          {DIRECTORS.map((member, i) => (
            <DirectorCard key={member.name} member={member} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function JoinCta() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <section
      ref={ref}
      className="relative bg-black border-t border-zinc-900 py-20 sm:py-28 px-6 sm:px-12 overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative max-w-4xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-4"
        >
          Join Us
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="font-serif text-3xl sm:text-5xl text-white leading-[0.95] mb-5"
        >
          Want to help bring speakers to Stanford?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="font-sans text-base sm:text-lg text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed"
        >
          We recruit new members each year. If you&rsquo;d like to be part of
          the team that decides who speaks at Stanford, reach out.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <MotionLink
            href="/contact"
            prefetch={false}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#A80D0C] px-8 py-3.5 text-sm sm:text-base font-semibold text-white shadow-lg shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211]"
          >
            Get in touch
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </MotionLink>
        </motion.div>
      </div>
    </section>
  );
}

export default function TeamClient() {
  return (
    <div className="flex min-h-screen flex-col bg-black font-sans">
      <main className="flex w-full flex-col">
        <TeamHero />
        <LeadershipSection />
        <DirectorsSection />
        <JoinCta />
      </main>
    </div>
  );
}
