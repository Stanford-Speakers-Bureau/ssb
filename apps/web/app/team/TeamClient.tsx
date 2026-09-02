"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { type TeamMember, ADVISORS, TEAMS } from "./members";

type TeamGroup = { id: string; name: string; members: TeamMember[] };

const ALL_GROUPS: TeamGroup[] = [
  ...TEAMS,
  { id: "advisors", name: "Advisors", members: ADVISORS },
];

const PRESIDENCY = ALL_GROUPS[0];

function JoinCard({ className = "aspect-[3/4]" }: { className?: string }) {
  return (
    <Link
      href="/join"
      prefetch={false}
      className={`group relative w-full overflow-hidden border border-dashed border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center text-center p-4 sm:p-6 transition-all duration-500 hover:border-ssb-accent hover:bg-ssb-accent/5 focus-visible:outline-ssb-accent focus-visible:outline-2 ${className}`}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-ssb-accent/10 text-ssb-accent mb-4 transition-colors group-hover:bg-ssb-accent/20">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </div>
      <p className="font-mono text-[0.625rem] tracking-[0.25em] uppercase text-ssb-accent-strong mb-2">
        This could be you
      </p>
      <h3 className="font-serif text-lg sm:text-xl text-white leading-tight mb-3">
        Join the team.
      </h3>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white group-hover:text-ssb-accent transition-colors">
        Get in touch
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}

function MosaicTile({
  member,
  index,
  large = false,
}: {
  member: TeamMember;
  index: number;
  large?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: (index % 5) * 0.06, ease: "easeOut" }}
      className={`group relative w-full overflow-hidden bg-zinc-900 ${
        large ? "h-64 sm:h-80" : "h-52 sm:h-64"
      }`}
    >
      {member.image.includes("blank-headshot") ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <span className="font-serif text-4xl sm:text-5xl text-zinc-700 select-none">
            {member.name
              .split(" ")
              .map((word) => word[0])
              .slice(0, 2)
              .join("")}
          </span>
        </div>
      ) : (
        <Image
          src={member.image}
          alt={member.name}
          fill
          className={`object-cover grayscale-[40%] will-change-[scale,filter] transition-[scale,filter] duration-700 ease-out group-hover:grayscale-0 ${
            member.imageClassName ?? "group-hover:scale-[1.06]"
          }`}
          sizes={
            large
              ? "(max-width: 640px) 50vw, 33vw"
              : "(max-width: 640px) 50vw, 20vw"
          }
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
        {/* Reserve two lines so first lines align across tiles with wrapped names. */}
        <h3
          className={`font-serif text-white leading-snug text-pretty min-h-[2.75em] ${
            large ? "text-base sm:text-xl" : "text-sm sm:text-base"
          }`}
        >
          {member.name}
        </h3>
      </div>
    </motion.div>
  );
}

const EXEC_EMAIL = "exec@stanfordspeakersbureau.com";

function ContactCard({ className = "" }: { className?: string }) {
  return (
    <a
      href={`mailto:${EXEC_EMAIL}`}
      className={`group relative h-64 sm:h-80 w-full overflow-hidden bg-zinc-900 ring-1 ring-ssb-accent/30 transition-colors duration-500 hover:ring-ssb-accent focus-visible:outline-ssb-accent focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
    >
      <div className="absolute inset-0 bg-linear-to-tr from-ssb-accent/30 via-ssb-accent/[0.06] to-transparent transition-opacity duration-500 opacity-80 group-hover:opacity-100" />
      <svg
        className="absolute top-3 right-3 sm:top-4 sm:right-4 text-zinc-500 transition-all duration-300 group-hover:text-ssb-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
        <p className="font-mono text-[0.625rem] tracking-[0.25em] uppercase text-ssb-accent-strong mb-1.5">
          Write to us
        </p>
        <h3 className="font-serif text-xl sm:text-2xl text-white leading-snug">
          Have an idea?
        </h3>
        <p className="mt-1.5 text-[0.65rem] text-zinc-300 transition-colors group-hover:text-ssb-accent-strong break-words">
          {EXEC_EMAIL}
        </p>
      </div>
    </a>
  );
}

export default function TeamClient() {
  const rest = ALL_GROUPS.slice(1);
  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100 isolate">
      {/* Hero */}
      <section className="relative min-h-[80svh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/team.jpg"
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
            The students who <span className="text-ssb-accent">make this</span>{" "}
            happen.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base sm:text-lg text-zinc-300 max-w-xl text-pretty leading-relaxed"
          >
            SSB is run by an all-student board. We meet weekly to decide who
            should come to campus, secure the funding, and put on the shows.
          </motion.p>
        </div>
      </section>

      <section className="px-6 sm:px-16 py-20 sm:py-28 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-4 sm:gap-5">
            {/* Presidency: full row — both presidents and the contact card. */}
            <div className="basis-full bg-zinc-900/60 ring-1 ring-zinc-800 p-3 sm:p-4">
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <p className="font-mono text-[0.6875rem] tracking-[0.3em] uppercase text-ssb-accent-strong">
                  {PRESIDENCY.name}
                </p>
                <p className="font-mono text-[0.6875rem] tracking-[0.3em] uppercase text-zinc-500">
                  2026 – 2027
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {PRESIDENCY.members.map((member, i) => (
                  <MosaicTile key={member.name} member={member} index={i} large />
                ))}
                <ContactCard className="col-span-2 lg:col-span-1" />
              </div>
            </div>

            {/* Remaining teams: panels sized by headcount so rows fill. */}
            {rest.map((group) => (
              <div
                key={group.id}
                style={{
                  flexGrow: group.members.length,
                  flexBasis: `${group.members.length * 9}rem`,
                }}
                className="bg-zinc-900/60 ring-1 ring-zinc-800 p-3 sm:p-4 min-w-0"
              >
                <p
                  className={`font-mono text-[0.6875rem] tracking-[0.3em] uppercase mb-3 ${
                    group.id === "advisors"
                      ? "text-zinc-400"
                      : "text-ssb-accent-strong"
                  }`}
                >
                  {group.name}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {group.members.map((member, i) => (
                    <div key={member.name} className="flex-1 min-w-28 max-w-40">
                      <MosaicTile member={member} index={i} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <JoinCard className="aspect-auto min-h-56 grow basis-44" />
          </div>
        </div>
      </section>
    </main>
  );
}
