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
    description: "Get notified about upcoming speakers, ticket drops, and events.",
    href: "https://mailman.stanford.edu/mailman/listinfo/ssb-announce",
    label: "Subscribe",
    external: true,
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
    description: "Questions about events, sponsorships, or programs? Reach out.",
    href: "/contact",
    label: "Get in Touch",
  },
];

export default function CtaSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="relative bg-black py-20 sm:py-28 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      <div ref={ref} className="relative z-10 max-w-6xl mx-auto px-6 sm:px-12">
        <div className="text-center mb-14">
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
            Get Involved
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-white mb-4">
            Join the Community
          </h2>
          <p className="font-sans text-base text-zinc-400 max-w-lg mx-auto">
            Whether you want to attend events, suggest speakers, or partner with
            us — there&rsquo;s a place for you at SSB.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
              className="group relative rounded border border-zinc-800 bg-zinc-950 p-8 transition-all duration-500 hover:border-[#A80D0C]/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#A80D0C]/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#A80D0C]/10 text-[#A80D0C] mb-5 transition-colors group-hover:bg-[#A80D0C]/20">
                {card.icon}
              </div>
              <h3 className="font-serif text-xl text-white mb-2">
                {card.title}
              </h3>
              <p className="font-sans text-sm text-zinc-400 leading-relaxed mb-6">
                {card.description}
              </p>
              <MotionLink
                href={card.href}
                prefetch={false}
                target={card.external ? "_blank" : undefined}
                rel={card.external ? "noopener noreferrer" : undefined}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-full bg-[#A80D0C] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C11211]"
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
