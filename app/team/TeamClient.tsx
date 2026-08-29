"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { LEADERSHIP, DIRECTORS, type TeamMember, ADVISORS } from "./members";

function LeaderCard({ member, index }: { member: TeamMember; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
      className="group"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-900 mb-5">
        <Image
          src={member.image}
          alt={member.name}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      <p className="font-mono text-[0.6rem] tracking-[0.35em] uppercase text-ssb-accent mb-2">
        {member.role}
      </p>
      <h3 className="font-serif text-2xl sm:text-3xl text-white mb-2 leading-tight">
        {member.name}
      </h3>
      {member.bio && (
        <p className="text-sm text-zinc-400 text-pretty leading-relaxed mb-3">
          {member.bio}
        </p>
      )}
      {member.email && (
        <a
          href={`mailto:${member.email}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-ssb-accent transition-colors"
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
      transition={{ duration: 0.5, delay: index * 0.07, ease: "easeOut" }}
      className="group relative overflow-hidden"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-900">
        <Image
          src={member.image}
          alt={member.name}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h3 className="font-serif text-xl sm:text-2xl text-white leading-tight mb-1">
            {member.name}
          </h3>
          <p className="font-mono text-[0.58rem] tracking-[0.25em] uppercase text-ssb-accent">
            {member.role}
          </p>
        </div>
      </div>
      {member.email && (
        <a
          href={`mailto:${member.email}`}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-ssb-accent transition-colors"
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

const EXEC_EMAIL = "exec@stanfordspeakersbureau.com";

function EnvelopeIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ContactCard({
  index,
  variant = "leader",
}: {
  index: number;
  variant?: "leader" | "director";
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const isLeader = variant === "leader";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: isLeader ? 24 : 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: isLeader ? 0.6 : 0.5,
        delay: index * (isLeader ? 0.1 : 0.07),
        ease: "easeOut",
      }}
      className="group"
    >
      <a
        href={`mailto:${EXEC_EMAIL}`}
        target="_blank"
        className="block focus-visible:outline-ssb-accent focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {isLeader ? (
          <>
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-900 mb-5">
              <div className="absolute inset-0 bg-linear-to-t from-ssb-accent/30 via-zinc-900 to-zinc-900" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 transition-transform duration-700 ease-out group-hover:scale-[1.04]">
                <div className="flex size-16 items-center justify-center rounded-full bg-ssb-accent/15 text-ssb-accent mb-5 ring-1 ring-ssb-accent/25">
                  <EnvelopeIcon size={26} />
                </div>
                <p className="font-serif text-2xl text-white text-center leading-tight">
                  Write to us.
                </p>

                <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-ssb-accent group-hover:text-ssb-accent-strong transition-colors break-all">
                  <EnvelopeIcon size={12} />
                  {EXEC_EMAIL}
                </span>
              </div>
            </div>
            <p className="font-mono text-[0.6rem] tracking-[0.35em] uppercase text-ssb-accent mb-2">
              Contact
            </p>
            <h3 className="font-serif text-2xl sm:text-3xl text-white mb-2 leading-tight">
              Have an idea?
            </h3>
          </>
        ) : (
          <div className="relative aspect-square w-full overflow-hidden bg-zinc-900">
            <div className="absolute inset-0 bg-linear-to-t from-black via-zinc-900/80 to-ssb-accent/20" />
            <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
              <div className="flex size-10 items-center justify-center rounded-full bg-ssb-accent/15 text-ssb-accent mb-4 ring-1 ring-ssb-accent/25">
                <EnvelopeIcon size={18} />
              </div>
              <p className="font-mono text-[0.58rem] tracking-[0.25em] uppercase text-ssb-accent mb-1">
                Contact
              </p>
              <h3 className="font-serif text-xl sm:text-2xl text-white leading-tight mb-2">
                Have an idea?
              </h3>
            </div>
          </div>
        )}
      </a>
    </motion.div>
  );
}

function RecruitCard({ index }: { index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease: "easeOut" }}
    >
      <Link
        href="/join"
        prefetch={false}
        className="group relative aspect-square w-full overflow-hidden border border-dashed border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center text-center p-6 sm:p-8 transition-all duration-500 hover:border-ssb-accent hover:bg-ssb-accent/5 focus-visible:outline-ssb-accent focus-visible:outline-2"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-ssb-accent/10 text-ssb-accent mb-5 transition-colors group-hover:bg-ssb-accent/20">
          <svg
            width="22"
            height="22"
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
        <p className="font-mono text-[0.6rem] tracking-[0.3em] uppercase text-ssb-accent mb-3">
          This could be you
        </p>
        <h3 className="font-serif text-xl sm:text-2xl text-white leading-tight mb-2">
          Join the team.
        </h3>
        <p className="text-sm text-zinc-400 text-pretty leading-relaxed mb-4 max-w-xs">
          and help bring big names to campus!
        </p>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white group-hover:text-ssb-accent transition-colors">
          Get in touch
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
            className="transition-transform group-hover:translate-x-0.5"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </Link>
    </motion.div>
  );
}

export default function TeamClient() {
  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100 isolate">
      {/* Hero */}
      <section className="relative min-h-dvh flex items-end overflow-hidden">
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

      {/* Executive Leadership */}
      <section className="px-6 sm:px-16 py-20 sm:py-28 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 sm:mb-16">
            <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight">
              Executive Leadership
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
            {LEADERSHIP.map((member, i) => (
              <LeaderCard key={member.name} member={member} index={i} />
            ))}

            <ContactCard index={LEADERSHIP.length} variant="leader" />
          </div>
        </div>
      </section>

      {/* Directors */}
      <section className="px-6 sm:px-16 py-20 sm:py-28 border-t border-zinc-800 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 sm:mb-16">
            <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight">
              Board
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {DIRECTORS.map((member, i) => (
              <DirectorCard key={member.name} member={member} index={i} />
            ))}
            {DIRECTORS.length % 3 !== 0 && (
              <RecruitCard index={DIRECTORS.length} />
            )}
          </div>
        </div>
      </section>

      {/* Advisors */}
      <section className="px-6 sm:px-16 py-20 sm:py-28 border-t border-zinc-800 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 sm:mb-16">
            <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight">
              Advisors
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {ADVISORS.map((member, i) => (
              <DirectorCard key={member.name} member={member} index={i} />
            ))}
            {ADVISORS.length % 3 !== 0 && (
              <RecruitCard index={ADVISORS.length} />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
