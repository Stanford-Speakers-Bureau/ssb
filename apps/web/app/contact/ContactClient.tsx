"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";

const REASONS = [
  {
    kicker: "General",
    title: "Questions or ideas",
    description:
      "Event ideas, press inquiries, partnerships, or anything else. We read every message.",
    cta: {
      label: "Email the Co-Presidents",
      href: "mailto:exec@stanfordspeakersbureau.com",
      external: true,
    },
  },
  {
    kicker: "Sponsorship",
    title: "Co-sponsor an event",
    description:
      "Hosting a speaker and need funding or full-service support? Check the guidelines first, then reach out.",
    cta: { label: "See sponsorship programs", href: "/event-sponsorship" },
  },
  {
    kicker: "Suggestions",
    title: "Suggest a speaker",
    description:
      "Know someone the Stanford community should hear from? Submit them to the leaderboard.",
    cta: { label: "Submit a suggestion", href: "/suggest" },
  },
];

const ArrowIcon = () => (
  <svg
    width="13"
    height="13"
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
);

export default function ContactClient() {
  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100 isolate">
      {/* Hero */}
      <section className="relative min-h-dvh flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/students.jpeg"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/65 to-zinc-950/25" />
          <div className="absolute inset-0 bg-linear-to-r from-zinc-950/70 to-transparent" />
        </div>
        <div className="relative z-10 px-6 sm:px-16 pb-20 pt-40 max-w-5xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="font-serif text-5xl sm:text-7xl md:text-8xl text-white leading-none tracking-tight mb-6 text-balance max-w-[16ch]"
          >
            Get in <span className="text-ssb-accent">touch.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base sm:text-lg text-zinc-300 max-w-lg text-pretty leading-relaxed"
          >
            Ideas, sponsorships, press, or just a question — we read every
            message.
          </motion.p>
        </div>
      </section>

      {/* Three ways to reach us */}
      <section className="px-6 sm:px-16 py-20 sm:py-28 border-t border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14 sm:mb-16">
            <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight text-balance max-w-xl">
              Three ways to reach us.
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800">
            {REASONS.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                className="bg-zinc-950 p-8 sm:p-10 flex flex-col group hover:bg-zinc-900 transition-colors"
              >
                <p className="font-mono text-[0.6rem] tracking-[0.35em] uppercase text-ssb-accent mb-4">
                  {r.kicker}
                </p>
                <h3 className="font-serif text-xl sm:text-2xl text-white mb-3 text-pretty">
                  {r.title}
                </h3>
                <p className="text-sm text-zinc-400 text-pretty leading-relaxed mb-8 flex-1">
                  {r.description}
                </p>
                {r.cta.external ? (
                  <a
                    href={r.cta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 self-start rounded-full bg-ssb-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-ssb-accent-strong transition-colors focus-visible:outline-ssb-accent focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {r.cta.label}
                    <ArrowIcon />
                  </a>
                ) : (
                  <Link
                    href={r.cta.href}
                    prefetch={false}
                    className="inline-flex items-center gap-2 self-start rounded-full border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
                  >
                    {r.cta.label}
                    <ArrowIcon />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Further reading */}
      <section className="px-6 sm:px-16 py-16 border-t border-zinc-800 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-[0.65rem] tracking-[0.5em] uppercase text-ssb-accent mb-4">
            Further reading
          </p>
          <p className="font-serif text-xl sm:text-2xl text-zinc-200 text-pretty leading-relaxed max-w-2xl">
            Before planning an event, the{" "}
            <a
              href="https://ose.stanford.edu/student-orgs/event-planning"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ssb-accent hover:underline underline-offset-4 decoration-ssb-accent/40"
            >
              Office of Student Engagement
            </a>{" "}
            walks through campus logistics. For funding guidelines, see the{" "}
            <Link
              href="/event-sponsorship"
              prefetch={false}
              className="text-ssb-accent hover:underline underline-offset-4 decoration-ssb-accent/40"
            >
              Event Sponsorship
            </Link>{" "}
            page.
          </p>
        </div>
      </section>
    </main>
  );
}
