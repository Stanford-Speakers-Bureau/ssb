"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";

const CO_PRES_EMAIL = "ajoshi17@stanford.edu,anishan@stanford.edu";
const APPLICATION_FORM = "https://forms.gle/82WaYv3C6oQC8bHU7";

const ACTIVITIES = [
  {
    n: "01",
    title: "Pitch the people you want to hear.",
    body: "Every Monday, members bring names to the table. If you can make the case, the room backs you.",
  },
  {
    n: "02",
    title: "Reach out to agents, managers, and teams.",
    body: "You'll learn to land speakers that students dream of. You'll hear back more than you'd think.",
  },
  {
    n: "03",
    title: "Plan the show, end to end.",
    body: "Book venues, negotiate fees, handle logistics, host the speaker the day of. Real ownership, not busywork.",
  },
  {
    n: "04",
    title: "Put it on stage.",
    body: "Run the event in front of a packed Stanford audience. Then do it again next month.",
  },
];

const PERKS = [
  {
    symbol: "✦",
    title: "A front-row seat.",
    body: "You meet the speakers — backstage, before the event. You'll have real conversations with people most only see on screens.",
  },
  {
    symbol: "◆",
    title: "Real ownership.",
    body: "You're not a volunteer. From pitch to stage, you run the event. The decisions are yours, and so is the credit.",
  },
  {
    symbol: "●",
    title: "Your people.",
    body: "A tight group of curious, driven Stanford students who become your closest collaborators — and often your closest friends.",
  },
];

export default function JoinClient() {
  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100 isolate">
      {/* Hero */}
      <section className="relative min-h-dvh flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/meeting.JPG"
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
            className="font-serif text-5xl sm:text-7xl md:text-8xl text-white leading-none tracking-tight mb-6 text-balance max-w-[18ch]"
          >
            Bringing speakers could be{" "}
            <span className="text-ssb-accent">up to you.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base sm:text-lg text-zinc-300 max-w-xl mb-10 text-pretty leading-relaxed"
          >
            SSB is a student-run board (undergrad and grad) that meets every
            Monday, reaches out to the biggest names, and puts on events.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <a
              href={APPLICATION_FORM}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-ssb-accent px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-ssb-accent/25 hover:bg-ssb-accent-strong transition-colors focus-visible:outline-ssb-accent focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Request Membership Info
            </a>
            <a
              href={`mailto:${CO_PRES_EMAIL}`}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-7 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Email Co-Presidents
            </a>
          </motion.div>
        </div>
      </section>

      {/* How it happens */}
      <section className="border-t border-zinc-800 px-6 sm:px-16 py-24 sm:py-32">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16 sm:mb-20">
            <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight text-balance max-w-4xl">
              Pitch. Negotiate. Produce. Repeat.
            </h2>
          </div>
          <div>
            {ACTIVITIES.map((a, i) => (
              <div
                key={a.n}
                className="grid grid-cols-[52px_1fr] sm:grid-cols-[72px_1fr] gap-6 sm:gap-12 border-t border-zinc-800 py-10 last:border-b"
              >
                <div className="flex flex-col items-center">
                  <span className="font-serif text-2xl sm:text-3xl text-ssb-accent tabular-nums leading-none shrink-0 mt-1">
                    {a.n}
                  </span>
                  {i < ACTIVITIES.length - 1 && (
                    <div className="flex-1 w-px bg-linear-to-b from-ssb-accent/20 to-transparent mt-4" />
                  )}
                </div>
                <div className="pb-2">
                  <h3 className="font-serif text-xl sm:text-3xl text-white mb-3 text-pretty">
                    {a.title}
                  </h3>
                  <p className="text-base text-zinc-400 text-pretty leading-relaxed max-w-2xl">
                    {a.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you actually get */}
      <section className="border-t border-zinc-800 px-6 sm:px-16 py-20 sm:py-28 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14 sm:mb-16">
            <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight text-balance max-w-4xl">
              More than a line on your resume.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800">
            {PERKS.map((p) => (
              <div
                key={p.title}
                className="bg-zinc-950 p-8 sm:p-10 group hover:bg-zinc-900 transition-colors"
              >
                <span className="text-ssb-accent/70 group-hover:text-ssb-accent text-xl block mb-8 transition-colors">
                  {p.symbol}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl text-white mb-3 text-pretty">
                  {p.title}
                </h3>
                <p className="text-sm text-zinc-400 text-pretty leading-relaxed">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 sm:px-16 py-24 sm:py-32 overflow-hidden border-t border-zinc-800">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-b from-ssb-accent/6 via-transparent to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-ssb-accent/40 blur-sm"
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl sm:text-6xl text-white tracking-tight mb-5 text-balance">
            Recruitment season is coming.
          </h2>
          <p className="text-base text-zinc-400 mb-10 text-pretty leading-relaxed max-w-lg mx-auto">
            We bring on a small group of new members each year. Get on the list
            and we'll reach out when applications open.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={APPLICATION_FORM}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-ssb-accent px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-ssb-accent/20 hover:bg-ssb-accent-strong transition-colors focus-visible:outline-ssb-accent focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Get on the List
            </a>
            <a
              href={`mailto:${CO_PRES_EMAIL}`}
              className="inline-flex items-center justify-center rounded-full border border-zinc-700 px-8 py-3.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
            >
              Email Co-Presidents
            </a>
            <Link
              href="/upcoming-speakers"
              prefetch={false}
              className="inline-flex items-center justify-center rounded-full border border-zinc-700 px-8 py-3.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
            >
              Upcoming Events
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
