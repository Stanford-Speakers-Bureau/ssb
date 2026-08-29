"use client";

import Link from "next/link";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

const MotionLink = motion.create(Link);

type CtaCard = {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  label: string;
  external?: boolean;
};

const CARDS: CtaCard[] = [
  {
    icon: (
      <svg
        width="24"
        height="24"
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
    title: "Mailing List",
    description:
      "Get notified about upcoming speakers, ticket drops, and events.",
    href: "/subscribe",
    label: "Subscribe",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2" />
        <path d="m8 12 3 3 5-5" />
      </svg>
    ),
    title: "Suggest a Speaker",
    description: "Have an idea for who should come to Stanford? Tell us.",
    href: "/suggest",
    label: "Submit",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: "Contact Us",
    description:
      "Questions about events, sponsorships, or programs? Reach out.",
    href: "/contact",
    label: "Get in Touch",
  },
];

export default function CtaSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(219,76,58,0.12),transparent_28%),linear-gradient(180deg,#140f0e_0%,#0f0b0a_100%)] py-20 sm:py-28">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute right-[-120px] top-12 h-72 w-72 rounded-full bg-[#c93f2d]/24 blur-3xl"
      />

      <div ref={ref} className="relative z-10 mx-auto max-w-6xl px-6 sm:px-12">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-[#f19a80] sm:text-sm">
            Get Involved
          </p>
          <h2 className="mb-4 font-serif text-3xl text-white sm:text-5xl">
            Join the Community
          </h2>
          <p className="mx-auto max-w-lg font-sans text-base text-[#c6b6aa]">
            Whether you want to attend events, suggest speakers, or partner with
            us, there&rsquo;s a place for you at SSB.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
              className="group relative rounded-[28px] border border-white/10 bg-[rgba(24,19,17,0.9)] p-8 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-[#b51f1a]/50 hover:shadow-[0_24px_60px_rgba(181,31,26,0.14)]"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#b51f1a]/12 text-[#f19a80] transition-colors group-hover:bg-[#b51f1a]/20">
                {card.icon}
              </div>
              <h3 className="mb-2 font-serif text-xl text-white">
                {card.title}
              </h3>
              <p className="mb-6 font-sans text-sm leading-relaxed text-[#b9a79b]">
                {card.description}
              </p>
              <MotionLink
                href={card.href}
                prefetch={false}
                target={card.external ? "_blank" : undefined}
                rel={card.external ? "noopener noreferrer" : undefined}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-full bg-[#b51f1a] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d24634]"
              >
                {card.label}
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
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
