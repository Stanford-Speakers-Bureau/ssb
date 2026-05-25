"use client";

import Image from "next/image";
import { motion } from "motion/react";

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

const FUNDING_ITEMS = [
  { label: "Speaker fees", body: "Honoraria and appearance fees to secure the names you want." },
  { label: "Venue rental", body: "From Dinkelspiel to small classrooms, we cover the room." },
  { label: "Event services", body: "AV, catering, security, and anything else you need to host." },
  { label: "Advertising", body: "Posters, social promotion, and cross-org outreach." },
  { label: "Event staffing", body: "SSB team members on hand to help run day-of logistics." },
  { label: "Speaker contracts", body: "We negotiate the legal and logistical details with agents for you." },
];

type Tier = {
  title: string;
  description: string;
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    title: "Community Uplift Fund",
    description:
      "We prioritize events centering voices from traditionally marginalized communities on campus. If your org is hosting a speaker who speaks to a community we've underfunded historically, start here.",
    featured: true,
  },
  {
    title: "Co-Sponsorships",
    description:
      "Have a strong event idea and need a funding boost? We contribute toward speaker fees, venues, and event services so you can land the speaker you actually want.",
  },
  {
    title: "Partnerships",
    description:
      "From finding speakers and negotiating honoraria to venue booking and day-of staffing, we run the event with you, not just next to you.",
  },
];

type Step = { num: string; title: string; body: React.ReactNode };

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
          className="font-semibold text-ssb-accent hover:underline underline-offset-2"
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
          className="font-semibold text-ssb-accent hover:underline underline-offset-2"
        >
          application form
        </a>
        . We review on a first-come, first-served basis, so apply early.
      </>
    ),
  },
  {
    num: "03",
    title: "Present",
    body: "Give a five-minute presentation at one of our weekly SSB team meetings. We'll ask questions and vote on the spot.",
  },
  {
    num: "04",
    title: "Get funded",
    body: "Approved events receive funding and, for partnerships, ongoing support through the day of the event. The full review cycle typically takes under two weeks.",
  },
];

const ArrowIcon = ({ className }: { className?: string }) => (
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
    className={className}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export default function EventSponsorshipClient() {
  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100 isolate">

      {/* Hero */}
      <section className="relative min-h-dvh flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/meeting.JPG"
            alt="Stanford Speakers Bureau team meeting"
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
            className="font-serif text-5xl sm:text-7xl md:text-8xl text-white leading-none tracking-tight mb-6 text-balance max-w-[18ch]"
          >
            <span className="relative inline-block text-ssb-accent">
              Funding
              <motion.svg
                aria-hidden="true"
                viewBox="0 0 300 20"
                fill="none"
                preserveAspectRatio="none"
                className="absolute left-0 -bottom-1 sm:-bottom-2 h-2.5 sm:h-3.5 w-full overflow-visible"
              >
                <motion.path
                  d="M4 13 C 50 5, 95 5, 145 10 C 195 15, 250 15, 296 7"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.9, delay: 0.75, ease: "easeOut" }}
                />
              </motion.svg>
            </span>{" "}
            student events since 1935.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base sm:text-lg text-zinc-300 max-w-xl mb-10 text-pretty leading-relaxed"
          >
            From targeted community funding to full-service event partnerships,
            SSB supports student organizations bringing speakers to Stanford.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <a
              href={APPLICATION_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-ssb-accent px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-ssb-accent/25 hover:bg-ssb-accent-strong transition-colors focus-visible:outline-ssb-accent focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Apply now
              <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={EVAL_DOC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-7 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Read the evaluation doc
            </a>
          </motion.div>
        </div>
      </section>

      {/* Programs — three tiers */}
      <section className="relative px-6 sm:px-16 py-20 sm:py-28 border-t border-zinc-800 overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-0 size-[32rem] rounded-full bg-ssb-accent/8 blur-3xl" />
        <div className="relative max-w-6xl mx-auto">
          <div className="mb-14 sm:mb-16">
            <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight text-balance max-w-4xl">
              Three ways we back student events.
            </h2>
            <p className="text-base text-zinc-400 max-w-xl mt-4 text-pretty leading-relaxed">
              Every event is different. Pick the tier that matches what you need
              and we&rsquo;ll figure out the rest together.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-5">
            {TIERS.map((tier, i) => (
              <motion.article
                key={tier.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ type: "spring", stiffness: 130, damping: 16, delay: i * 0.08 }}
                className={`group relative grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 sm:gap-10 rounded-3xl border p-8 sm:p-10 ${
                  tier.featured
                    ? "border-ssb-accent/40 bg-ssb-accent/5 shadow-xl shadow-ssb-accent/5"
                    : "border-zinc-800 bg-zinc-900/30"
                }`}
              >
                {tier.featured && (
                  <div aria-hidden="true" className="pointer-events-none absolute -inset-px rounded-3xl bg-linear-to-br from-ssb-accent/10 to-transparent" />
                )}
                <div className="relative flex items-start gap-5 md:w-72">
                  <span className="font-serif text-6xl sm:text-7xl text-ssb-accent tabular-nums leading-none select-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl text-white tracking-tight text-balance mt-1">
                    {tier.title}
                  </h3>
                </div>
                <div className="relative flex flex-col gap-5">
                  <p className="text-base text-zinc-300 text-pretty leading-relaxed">
                    {tier.description}
                  </p>
                  {tier.featured && (
                    <div className="flex flex-wrap gap-2">
                      {COMMUNITY_TAGS.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-zinc-700 bg-zinc-900/50 px-3 py-1 text-xs font-semibold text-zinc-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* What we fund */}
      <section className="border-t border-zinc-800 bg-zinc-900/50 px-6 sm:px-16 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-10 lg:gap-16 items-start">
            <div className="lg:sticky lg:top-28">
              <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight mb-5 text-balance">
                Actual line items, not vibes.
              </h2>
              <p className="text-base text-zinc-400 text-pretty leading-relaxed">
                SSB covers the concrete costs of getting someone on stage at
                Stanford — the things the flyer never mentions but which make or
                break an event.
              </p>
            </div>
            <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {FUNDING_ITEMS.map((item, i) => (
                <motion.li
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ type: "spring", stiffness: 150, damping: 16, delay: i * 0.06 }}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
                >
                  <p className="font-serif text-lg text-white leading-tight mb-2">{item.label}</p>
                  <p className="text-sm text-zinc-400 text-pretty leading-relaxed">{item.body}</p>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Application process */}
      <section className="px-6 sm:px-16 py-20 sm:py-28 border-t border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16 sm:mb-20">
            <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight text-balance max-w-2xl">
              From application to funded event in under two weeks.
            </h2>
          </div>

          <div>
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ type: "spring", stiffness: 140, damping: 17, delay: i * 0.08 }}
                className="grid grid-cols-[52px_1fr] sm:grid-cols-[72px_1fr] gap-6 sm:gap-12 border-t border-zinc-800 py-10 last:border-b"
              >
                <div className="flex flex-col items-center">
                  <span className="font-serif text-2xl sm:text-3xl text-ssb-accent tabular-nums leading-none shrink-0 mt-1">
                    {step.num}
                  </span>
                  {i < STEPS.length - 1 && (
                    <motion.div
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: i * 0.08 + 0.25, ease: "easeOut" }}
                      className="flex-1 w-px origin-top bg-linear-to-b from-ssb-accent/40 to-transparent mt-4"
                    />
                  )}
                </div>
                <div className="pb-2">
                  <h3 className="font-serif text-xl sm:text-3xl text-white mb-3">{step.title}</h3>
                  <p className="text-base text-zinc-400 text-pretty leading-relaxed max-w-2xl">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 sm:px-16 py-24 sm:py-32 overflow-hidden border-t border-zinc-800">
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-ssb-accent/6 via-transparent to-transparent" />
        <div aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-ssb-accent/40 blur-sm" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl sm:text-6xl text-white tracking-tight mb-5 text-balance">
            Let&rsquo;s bring your speaker to Stanford.
          </h2>
          <p className="text-base text-zinc-400 mb-10 text-pretty leading-relaxed max-w-lg mx-auto">
            Submit an application and we&rsquo;ll be back within the week. Have
            questions first? Reach out to our Director of Co-Sponsorships.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={APPLICATION_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-ssb-accent px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-ssb-accent/20 hover:bg-ssb-accent-strong transition-colors focus-visible:outline-ssb-accent focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Apply for sponsorship
              <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={SPONSORSHIP_EMAIL}
              className="inline-flex items-center justify-center rounded-full border border-zinc-700 px-8 py-3.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
            >
              Email Cindy Toh
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
