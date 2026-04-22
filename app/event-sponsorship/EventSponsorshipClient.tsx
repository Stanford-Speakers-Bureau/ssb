"use client";

import Image from "next/image";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

const MotionA = motion.a;

const EVAL_DOC_URL =
  "https://docs.google.com/document/d/14YNE5wMrzkfKF-Otm_o4klpIHpqe1h5V/edit?usp=sharing_eil&rtpof=true&sd=true&ts=68fa9d1f";
const APPLICATION_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeAO0VRXyvxokpYWpFYPDg03UJ2oITF4LtWIF8GO0TIvyVIpA/viewform?usp=sharing&ouid=103384219620885640711";
const SPONSORSHIP_EMAIL =
  "mailto:ctoh28@stanford.edu,ajoshi17@stanford.edu,anishan@stanford.edu";

const COMMUNITY_TAGS = [
  "Communities of Color",
  "LGBTQ+",
  "Disabled",
  "Neurodivergent",
  "FLI",
];

const FUNDING_ITEMS: { label: string; body: string }[] = [
  {
    label: "Speaker fees",
    body: "Honoraria and appearance fees to secure the names you want.",
  },
  {
    label: "Venue rental",
    body: "From Dinkelspiel to small classrooms, we cover the room.",
  },
  {
    label: "Event services",
    body: "AV, catering, security, and anything else you need to host.",
  },
  {
    label: "Advertising",
    body: "Posters, social promotion, and cross-org outreach.",
  },
  {
    label: "Event staffing",
    body: "SSB team members on hand to help run day-of logistics.",
  },
  {
    label: "Speaker contracts",
    body: "We negotiate the legal and logistical details with agents for you.",
  },
];

type Tier = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    eyebrow: "Since 2020",
    title: "Community Uplift Fund",
    subtitle: "Priority funding",
    description:
      "We prioritize events centering voices from traditionally marginalized communities on campus. If your org is hosting a speaker who speaks to a community we've underfunded historically, start here.",
    featured: true,
  },
  {
    eyebrow: "Up to $1,500",
    title: "Co-Sponsorships",
    subtitle: "Financial support",
    description:
      "Have a strong event idea and need a funding boost? We contribute toward speaker fees, venues, and event services so you can land the speaker you actually want.",
  },
  {
    eyebrow: "End-to-end",
    title: "Partnerships",
    subtitle: "Full-service",
    description:
      "From finding speakers and negotiating honoraria to venue booking and day-of staffing — we run the event with you, not just next to you.",
  },
];

type Step = {
  num: string;
  title: string;
  body: React.ReactNode;
};

const STEPS: Step[] = [
  {
    num: "01",
    title: "Review",
    body: (
      <>
        Start with our{" "}
        <a
          href={EVAL_DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#A80D0C] hover:underline"
        >
          evaluation document
        </a>{" "}
        so you know what we&rsquo;re looking for before applying.
      </>
    ),
  },
  {
    num: "02",
    title: "Submit",
    body: (
      <>
        Complete the{" "}
        <a
          href={APPLICATION_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#A80D0C] hover:underline"
        >
          application form
        </a>
        . We review on a first-come, first-served basis — apply early.
      </>
    ),
  },
  {
    num: "03",
    title: "Present",
    body: (
      <>
        Give a five-minute presentation at one of our weekly SSB team meetings.
        We&rsquo;ll ask questions and vote on the spot.
      </>
    ),
  },
  {
    num: "04",
    title: "Get funded",
    body: (
      <>
        Approved events receive funding and, for partnerships, ongoing support
        through the day of the event. The full review cycle typically takes
        under two weeks.
      </>
    ),
  },
];

const EASE = [0.43, 0.13, 0.23, 0.96] as const;

function SponsorshipHero() {
  const reduce = useReducedMotion();
  return (
    <section className="relative w-full min-h-[88vh] flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0 opacity-40 dark:opacity-30"
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
            src="/meeting.JPG"
            alt="Stanford Speakers Bureau team meeting"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/95" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-12 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="inline-block mb-6 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-5 py-2 text-xs sm:text-sm font-sans uppercase tracking-[0.3em] text-white/80"
        >
          Sponsorship
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
          className="font-serif text-5xl sm:text-7xl md:text-8xl text-white leading-[0.92] mb-6"
        >
          <span className="text-[#A80D0C] drop-shadow-[0_0_40px_rgba(168,13,12,0.35)]">
            Funding
          </span>{" "}
          student events since 1935.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55, ease: EASE }}
          className="font-sans text-base sm:text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed mb-10"
        >
          From targeted community funding to full-service event partnerships,
          SSB supports student organizations bringing speakers to Stanford.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: EASE }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <MotionA
            href={APPLICATION_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] shadow-lg shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211]"
          >
            Apply now
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
          </MotionA>
          <MotionA
            href={EVAL_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm sm:text-base font-semibold text-white border border-white/30 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Read the evaluation doc
          </MotionA>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
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

function TierCard({ tier, index }: { tier: Tier; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const isFeatured = tier.featured;

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.12, ease: "easeOut" }}
      className={`group relative flex flex-col overflow-hidden rounded-lg border p-8 sm:p-10 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${
        isFeatured
          ? "md:col-span-2 md:row-span-1 border-[#A80D0C]/40 bg-[#A80D0C]/[0.07] hover:shadow-[#A80D0C]/10"
          : "border-zinc-900 bg-zinc-950 hover:border-[#A80D0C]/40 hover:shadow-black/40"
      }`}
    >
      <div className="flex items-baseline gap-3 mb-4">
        <p className="text-xs uppercase tracking-[0.25em] text-[#A80D0C] font-semibold">
          {tier.eyebrow}
        </p>
        {isFeatured && (
          <span className="inline-flex items-center gap-1 text-[10px] font-sans uppercase tracking-widest text-[#A80D0C] bg-[#A80D0C]/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A80D0C]" />
            Featured
          </span>
        )}
      </div>

      <h3
        className={`font-serif text-white leading-[0.95] mb-2 ${
          isFeatured ? "text-3xl sm:text-5xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {tier.title}
      </h3>
      <p className="font-sans text-sm italic text-zinc-500 mb-5">
        {tier.subtitle}
      </p>
      <p
        className={`font-sans text-zinc-300 leading-relaxed ${
          isFeatured ? "text-base max-w-2xl" : "text-sm"
        }`}
      >
        {tier.description}
      </p>

      {isFeatured && (
        <div className="mt-7 pt-6 border-t border-[#A80D0C]/20">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#A80D0C]/80 font-semibold mb-3">
            Priority communities
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMUNITY_TAGS.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-[#A80D0C]/30 bg-black text-[#A80D0C] px-3 py-1 text-xs font-semibold"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.article>
  );
}

function ProgramsSection() {
  return (
    <section className="bg-black py-20 sm:py-28 px-6 sm:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14 sm:mb-16">
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
            Our Programs
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-white leading-[0.95]">
            Three ways we back student events.
          </h2>
          <p className="font-sans text-base text-zinc-400 max-w-xl mx-auto mt-4 leading-relaxed">
            Every event is different. Pick the tier that matches what you need
            and we&rsquo;ll figure out the rest together.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
          {TIERS.map((tier, i) => (
            <TierCard key={tier.title} tier={tier} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FundingItem({
  item,
  index,
}: {
  item: (typeof FUNDING_ITEMS)[number];
  index: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.li
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      className="flex gap-4 p-5 rounded-lg border border-zinc-900 bg-black transition-colors hover:border-[#A80D0C]/40"
    >
      <div className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#A80D0C]/10 text-[#A80D0C]">
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
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <div>
        <p className="font-serif text-lg text-white mb-1 leading-tight">
          {item.label}
        </p>
        <p className="font-sans text-sm text-zinc-400 leading-relaxed">
          {item.body}
        </p>
      </div>
    </motion.li>
  );
}

function FundingSection() {
  return (
    <section className="bg-zinc-950 py-20 sm:py-28 px-6 sm:px-12 border-y border-zinc-900">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-10 lg:gap-16 items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-4">
              What we fund
            </p>
            <h2 className="font-serif text-3xl sm:text-5xl text-white leading-[0.95] mb-5">
              Actual line items, not vibes.
            </h2>
            <p className="font-sans text-base text-zinc-400 leading-relaxed">
              SSB covers the concrete costs of getting someone on stage at
              Stanford — the things the flyer never mentions but which make or
              break an event.
            </p>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FUNDING_ITEMS.map((item, i) => (
              <FundingItem key={item.label} item={item} index={i} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ProcessStep({ step, index }: { step: Step; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.li
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
      className="grid grid-cols-[auto_1fr] gap-6 sm:gap-10 border-b border-zinc-800 pb-10 last:border-b-0 last:pb-0"
    >
      <span className="font-serif text-5xl sm:text-7xl md:text-8xl text-[#A80D0C] leading-none tabular-nums">
        {step.num}
      </span>
      <div className="pt-2">
        <h3 className="font-serif text-2xl sm:text-3xl text-white mb-3 leading-tight">
          {step.title}
        </h3>
        <p className="font-sans text-base text-zinc-300 leading-relaxed max-w-xl">
          {step.body}
        </p>
      </div>
    </motion.li>
  );
}

function ProcessSection() {
  return (
    <section className="relative bg-black py-20 sm:py-28 px-6 sm:px-12 overflow-hidden">
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
        <div className="mb-12 sm:mb-16">
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-4">
            Application process
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-white leading-[0.95] max-w-2xl">
            From application to funded event in under two weeks.
          </h2>
        </div>

        <ol className="space-y-10">
          {STEPS.map((step, i) => (
            <ProcessStep key={step.num} step={step} index={i} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function CtaFooter() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <section
      ref={ref}
      className="relative bg-black border-t border-zinc-900 py-20 sm:py-24 px-6 sm:px-12"
    >
      <div className="max-w-4xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-4"
        >
          Ready?
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="font-serif text-3xl sm:text-5xl text-white leading-[0.95] mb-5"
        >
          Let&rsquo;s bring your speaker to Stanford.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="font-sans text-base text-zinc-400 max-w-lg mx-auto mb-10 leading-relaxed"
        >
          Submit an application and we&rsquo;ll be back within the week. Have
          questions first? Reach out to our Director of Co-Sponsorships.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <MotionA
            href={APPLICATION_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] shadow-lg shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211]"
          >
            Apply for sponsorship
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
          </MotionA>
          <MotionA
            href={SPONSORSHIP_EMAIL}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm sm:text-base font-semibold text-white border border-white/30 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Email Cindy Toh
          </MotionA>
        </motion.div>
      </div>
    </section>
  );
}

export default function EventSponsorshipClient() {
  return (
    <div className="flex min-h-screen flex-col bg-black font-sans">
      <main className="flex w-full flex-col">
        <SponsorshipHero />
        <ProgramsSection />
        <FundingSection />
        <ProcessSection />
        <CtaFooter />
      </main>
    </div>
  );
}
