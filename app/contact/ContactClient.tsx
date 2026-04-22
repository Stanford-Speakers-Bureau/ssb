"use client";

import Link from "next/link";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

const MotionLink = motion.create(Link);
const MotionA = motion.a;

const EASE = [0.43, 0.13, 0.23, 0.96] as const;

type ReasonCard = {
  kicker: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  cta: { label: string; href: string; external?: boolean };
};

const REASONS: ReasonCard[] = [
  {
    kicker: "General",
    title: "Questions or ideas",
    description:
      "Event ideas, press inquiries, partnerships, or anything else. We read every message.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
    cta: {
      label: "Email the Co-Presidents",
      href: "mailto:ajoshi17@stanford.edu,anishan@stanford.edu",
      external: true,
    },
  },
  {
    kicker: "Sponsorship",
    title: "Co-sponsor an event",
    description:
      "Hosting a speaker and need funding or full-service support? Check the guidelines first, then reach out.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    cta: {
      label: "See sponsorship programs",
      href: "/event-sponsorship",
    },
  },
  {
    kicker: "Suggestions",
    title: "Suggest a speaker",
    description:
      "Know someone the Stanford community should hear from? Submit them to the leaderboard.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 11l18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
    cta: {
      label: "Submit a suggestion",
      href: "/suggest",
    },
  },
];

function ContactHero() {
  return (
    <section className="relative w-full min-h-[70vh] flex items-center justify-center overflow-hidden bg-black">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#A80D0C]/10 blur-3xl pointer-events-none"
      />

      <div className="relative z-10 flex flex-col items-center px-6 sm:px-12 text-center max-w-4xl mx-auto pt-28 pb-20 sm:pt-36 sm:pb-24">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="inline-block mb-6 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-5 py-2 text-xs sm:text-sm font-sans uppercase tracking-[0.3em] text-white/80"
        >
          Contact
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
          className="font-serif text-5xl sm:text-7xl md:text-8xl text-white leading-[0.92] mb-6"
        >
          Get in{" "}
          <span className="text-[#A80D0C] drop-shadow-[0_0_40px_rgba(168,13,12,0.35)]">
            touch
          </span>
          .
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
          className="font-sans text-base sm:text-lg md:text-xl text-zinc-300 max-w-2xl leading-relaxed"
        >
          Ideas, sponsorships, press, or just a question &mdash; we read every
          message.
        </motion.p>
      </div>
    </section>
  );
}

function ReasonCardView({
  card,
  index,
}: {
  card: ReasonCard;
  index: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const ctaClass =
    "inline-flex items-center gap-2 rounded-full bg-[#A80D0C] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211] self-start";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.12, ease: "easeOut" }}
      className="group relative flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-black p-7 sm:p-8 transition-all duration-500 hover:-translate-y-1 hover:border-[#A80D0C]/50 hover:shadow-xl hover:shadow-[#A80D0C]/5"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#A80D0C]/10 text-[#A80D0C] mb-6 transition-colors group-hover:bg-[#A80D0C]/20">
        {card.icon}
      </div>
      <p className="text-xs uppercase tracking-[0.25em] text-[#A80D0C] mb-3 font-semibold">
        {card.kicker}
      </p>
      <h2 className="font-serif text-2xl sm:text-3xl text-zinc-900 dark:text-white mb-3 leading-tight">
        {card.title}
      </h2>
      <p className="font-sans text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-7 flex-1">
        {card.description}
      </p>
      {card.cta.external ? (
        <MotionA
          href={card.cta.href}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className={ctaClass}
        >
          {card.cta.label}
          <svg
            width="14"
            height="14"
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
        </MotionA>
      ) : (
        <MotionLink
          href={card.cta.href}
          prefetch={false}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className={ctaClass}
        >
          {card.cta.label}
          <svg
            width="14"
            height="14"
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
      )}
    </motion.div>
  );
}

function ReasonsSection() {
  return (
    <section className="bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-900 py-20 sm:py-28 px-6 sm:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
            Start Here
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-zinc-900 dark:text-white leading-[0.95]">
            Three ways to reach us.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {REASONS.map((card, i) => (
            <ReasonCardView key={card.title} card={card} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FurtherReading() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <section
      ref={ref}
      className="bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-900 py-16 sm:py-20 px-6 sm:px-12"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto text-center"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-[#A80D0C] mb-4">
          Further Reading
        </p>
        <p className="font-serif text-xl sm:text-2xl text-zinc-800 dark:text-zinc-200 leading-relaxed max-w-2xl mx-auto">
          Before planning an event, the{" "}
          <a
            href="https://ose.stanford.edu/student-orgs/event-planning"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#A80D0C] hover:underline underline-offset-4 decoration-[#A80D0C]/40"
          >
            Office of Student Engagement
          </a>{" "}
          walks through campus logistics. For funding guidelines, see the{" "}
          <Link
            href="/event-sponsorship"
            prefetch={false}
            className="text-[#A80D0C] hover:underline underline-offset-4 decoration-[#A80D0C]/40"
          >
            Event Sponsorship
          </Link>{" "}
          page.
        </p>
      </motion.div>
    </section>
  );
}

export default function ContactClient() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans dark:bg-black">
      <main className="flex w-full flex-col">
        <ContactHero />
        <ReasonsSection />
        <FurtherReading />
      </main>
    </div>
  );
}
