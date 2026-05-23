"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRightIcon,
  BellIcon,
  ClockIcon,
  DoorIcon,
  Markdown,
  MAILING_LIST_URL,
  PinIcon,
  SparkleIcon,
  Spinner,
  SPRING,
  SUGGEST_URL,
  TicketIcon,
  countdownSegments,
  ticketsLeft,
  useCountdown,
  useNotify,
  type SpeakerCardVM,
  type ThemeProps,
} from "./shared";

/* ===========================================================================
 * PRESS — dark screenprint poster. Near-black canvas, off-white chunky borders,
 * hard cardinal offset shadows, halftone dots, slight tilts, sticker tags.
 * Cardinal red anchor + bright cobalt / marigold / pink pops. Bricolage, snappy.
 * Built around a single featured speaker (stacks gracefully if there are more).
 * ======================================================================== */

const MotionLink = motion.create(Link);

const ACCENTS = ["#5B8CFF", "#F6B500", "#FF5C9D"] as const; // cobalt, marigold, pink

const TAG =
  "inline-flex items-center gap-1.5 rounded-full border-2 border-[#F2ECE0]/70 px-3 py-1 text-sm font-semibold text-[#F2ECE0]";

export default function PressTheme({ vms, hasEvents, isLoggedIn }: ThemeProps) {
  return (
    <div className="min-h-screen bg-[#141210] font-sans text-[#F2ECE0]">
      <Hero hasEvents={hasEvents} />

      {hasEvents ? (
        <section className="px-5 pb-20 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-12">
            {vms.map((vm, i) =>
              vm.mystery ? (
                <MysteryCard
                  key={vm.id}
                  vm={vm}
                  isLoggedIn={isLoggedIn}
                  index={i}
                />
              ) : (
                <FeaturedCard key={vm.id} vm={vm} index={i} />
              ),
            )}
          </div>
        </section>
      ) : (
        <EmptyState />
      )}

      <SuggestSection />
      <MailingSection />
    </div>
  );
}

function Hero({ hasEvents }: { hasEvents: boolean }) {
  return (
    <section className="relative overflow-hidden px-5 pt-32 pb-16 sm:px-8 sm:pt-40">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#F2ECE0_1.4px,transparent_1.4px)] [background-size:15px_15px]"
      />
      <div className="relative mx-auto max-w-5xl">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-[#141210] bg-[#F6B500] px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-[#141210] shadow-[3px_3px_0_0_#000]"
        >
          <SparkleIcon className="size-4" />
          {hasEvents ? "On the calendar" : "Between events"}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.05 }}
          className="font-display-poster mt-5 max-w-3xl text-5xl font-extrabold uppercase tracking-tight text-balance sm:text-7xl"
        >
          {hasEvents ? (
            <>
              Up <span className="text-[#FF6A4D]">next</span> on the SSB stage
            </>
          ) : (
            <>Nothing on the calendar yet</>
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.1 }}
          className="mt-5 max-w-2xl text-lg font-medium text-pretty text-[#C9BFAE]"
        >
          {hasEvents
            ? "We can't wait to welcome you to the next one. Get on the mailing list so you never miss a drop."
            : "We're between speakers. Drop a name on the suggest list or join the mailing list — you'll be first to know."}
        </motion.p>
      </div>
    </section>
  );
}

function FeaturedCard({ vm, index }: { vm: SpeakerCardVM; index: number }) {
  const accent = ACCENTS[index % ACCENTS.length];
  const left = ticketsLeft(vm);
  const lowStock = left != null && left > 0 && left <= 80;
  const tiltClass = index % 2 === 0 ? "-rotate-2" : "rotate-2";

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ ...SPRING, delay: index * 0.05 }}
      whileHover={{ x: -3, y: -3 }}
      style={{ "--accent": accent } as CSSProperties}
      className="group grid overflow-hidden rounded-[22px] border-[3px] border-[#F2ECE0] bg-[#1C1A17] shadow-[9px_9px_0_0_#E0492F] sm:grid-cols-[1.1fr_1fr]"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b-[3px] border-[#F2ECE0] sm:aspect-auto sm:min-h-[22rem] sm:border-b-0 sm:border-r-[3px]">
        {vm.imageUrl && (
          <Image
            src={vm.imageUrl}
            alt={vm.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 560px"
            priority
            unoptimized
          />
        )}
        <span
          className={`absolute left-4 top-4 ${tiltClass} rounded-lg border-2 border-[#141210] bg-(--accent) px-3 py-1 text-sm font-bold text-[#141210] shadow-[3px_3px_0_0_#000]`}
        >
          {vm.dateText || "Coming soon"}
        </span>
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-8">
        <h2 className="font-display-poster text-4xl font-extrabold uppercase tracking-tight text-[#F8F3EA] sm:text-5xl">
          {vm.name}
        </h2>
        {vm.header && (
          <Markdown className="mt-2 text-base font-medium leading-relaxed text-pretty text-[#C9BFAE] [&_a]:text-[#FF6A4D] [&_a]:underline [&_p]:m-0">
            {vm.header}
          </Markdown>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {vm.doorsOpenText && (
            <span className={TAG}>
              <DoorIcon className="size-4 text-(--accent)" />
              {vm.doorsOpenText}
            </span>
          )}
          {vm.eventTimeText && (
            <span className={TAG}>
              <ClockIcon className="size-4 text-(--accent)" />
              {vm.eventTimeText}
            </span>
          )}
          {vm.locationName &&
            (vm.locationUrl ? (
              <a
                href={vm.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={TAG}
              >
                <PinIcon className="size-4 text-(--accent)" />
                {vm.locationName}
              </a>
            ) : (
              <span className={TAG}>
                <PinIcon className="size-4 text-(--accent)" />
                {vm.locationName}
              </span>
            ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {vm.ctaText && vm.ctaHref && (
            <MotionLink
              href={vm.ctaHref}
              prefetch={false}
              whileHover={{ x: -2, y: -2 }}
              whileTap={{ x: 0, y: 0 }}
              className="inline-flex items-center gap-2 rounded-xl border-[3px] border-[#F2ECE0] bg-[#E0492F] px-5 py-3 text-base font-bold text-white shadow-[4px_4px_0_0_#F2ECE0]"
            >
              <TicketIcon className="size-5" />
              {vm.ctaText}
            </MotionLink>
          )}
          {lowStock && (
            <span className="text-sm font-bold text-[#FF6A4D] tabular-nums">
              Only {left} left!
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function MysteryCard({
  vm,
  isLoggedIn,
  index,
}: {
  vm: SpeakerCardVM;
  isLoggedIn: boolean;
  index: number;
}) {
  const { status, message, notify } = useNotify(
    vm.id,
    isLoggedIn,
    vm.isAlreadyNotified,
  );
  const parts = useCountdown(vm.revealDateRaw);

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ ...SPRING, delay: index * 0.05 }}
      className="relative flex flex-col items-center overflow-hidden rounded-[22px] border-[3px] border-[#F2ECE0] bg-[#1C1A17] px-6 py-12 text-center shadow-[9px_9px_0_0_#E0492F]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#F2ECE0_1.6px,transparent_1.6px)] [background-size:16px_16px]"
      />
      <div className="relative flex flex-col items-center">
        <span className="rounded-lg border-2 border-[#141210] bg-[#F6B500] px-3 py-1 text-sm font-bold uppercase tracking-wide text-[#141210] shadow-[3px_3px_0_0_#000]">
          Top secret
        </span>
        <div className="font-display-poster mt-4 text-8xl font-extrabold text-[#FF6A4D]">
          ?
        </div>
        <h2 className="font-display-poster mt-1 text-3xl font-extrabold uppercase tracking-tight text-[#F8F3EA]">
          To be announced
        </h2>
        {vm.dateText && (
          <p className="mt-1 text-base font-bold text-[#C9BFAE]">
            {vm.dateText}
          </p>
        )}

        {parts && (
          <div className="mt-6 flex items-end gap-2">
            {countdownSegments(parts).map((seg) => (
              <div key={seg.label} className="flex flex-col items-center">
                <div className="flex min-w-14 items-center justify-center rounded-lg border-2 border-[#F2ECE0] bg-[#141210] px-2.5 py-2 shadow-[3px_3px_0_0_#E0492F]">
                  <span className="text-2xl font-extrabold tabular-nums text-[#F8F3EA]">
                    {String(seg.value).padStart(2, "0")}
                  </span>
                </div>
                <span className="mt-1.5 text-xs font-bold uppercase tracking-wide text-[#C9BFAE]">
                  {seg.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-7">
          {status === "success" ? (
            <p className="rounded-lg border-2 border-[#F2ECE0] bg-[#141210] px-4 py-2 text-base font-bold text-[#F8F3EA]">
              {message}
            </p>
          ) : status === "error" ? (
            <div className="flex items-center gap-3">
              <p className="text-base font-bold text-[#FF6A4D]">{message}</p>
              <button
                onClick={notify}
                className="text-base font-bold text-[#F8F3EA] underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <motion.button
              onClick={notify}
              disabled={status === "loading"}
              whileHover={status === "loading" ? undefined : { x: -2, y: -2 }}
              whileTap={status === "loading" ? undefined : { x: 0, y: 0 }}
              className="inline-flex items-center gap-2 rounded-xl border-[3px] border-[#F2ECE0] bg-[#E0492F] px-6 py-3 text-base font-bold text-white shadow-[4px_4px_0_0_#F2ECE0] disabled:opacity-70"
            >
              {status === "loading" ? (
                <Spinner className="size-4" />
              ) : (
                <BellIcon className="size-4" />
              )}
              {status === "loading" ? "Signing up…" : "Notify me"}
            </motion.button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function SuggestSection() {
  return (
    <section className="px-5 py-16 sm:px-8 sm:py-20">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[26px] border-[3px] border-[#F2ECE0] bg-[#5B8CFF] px-8 py-14 text-center shadow-[10px_10px_0_0_#E0492F] sm:px-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-15 [background-image:radial-gradient(#141210_1.6px,transparent_1.6px)] [background-size:16px_16px]"
        />
        <div className="relative">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#141210]">
            Don&rsquo;t see them?
          </p>
          <h2 className="font-display-poster mx-auto mt-3 max-w-xl text-4xl font-extrabold uppercase tracking-tight text-balance text-[#141210] sm:text-6xl">
            Suggest a speaker
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-pretty text-[#141210]/80">
            Drop a name. Top picks become the outreach list for our booking team
            — your suggestion is what fills the calendar.
          </p>
          <MotionLink
            href={SUGGEST_URL}
            prefetch={false}
            whileHover={{ x: -2, y: -2 }}
            whileTap={{ x: 0, y: 0 }}
            className="mt-8 inline-flex items-center gap-2 rounded-xl border-[3px] border-[#141210] bg-[#E0492F] px-7 py-3.5 text-base font-bold text-white shadow-[4px_4px_0_0_#141210]"
          >
            <SparkleIcon className="size-5" />
            Suggest a Speaker
          </MotionLink>
        </div>
      </div>
    </section>
  );
}

function MailingSection() {
  return (
    <section className="px-5 pb-24 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center rounded-[26px] border-[3px] border-[#F2ECE0] bg-[#1C1A17] px-8 py-14 text-center shadow-[10px_10px_0_0_#5B8CFF] sm:px-12">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#FF6A4D]">
          Stay in the loop
        </p>
        <h2 className="font-display-poster mt-3 max-w-xl text-4xl font-extrabold uppercase tracking-tight text-balance text-[#F8F3EA] sm:text-6xl">
          Every speaker, in your inbox
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg font-medium text-pretty text-[#C9BFAE]">
          One email per event. No spam — just who&rsquo;s coming and when tickets
          drop.
        </p>
        <motion.a
          href={MAILING_LIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ x: -2, y: -2 }}
          whileTap={{ x: 0, y: 0 }}
          className="mt-8 inline-flex items-center gap-2 rounded-xl border-[3px] border-[#141210] bg-[#F6B500] px-7 py-3.5 text-base font-bold text-[#141210] shadow-[4px_4px_0_0_#141210]"
        >
          <BellIcon className="size-5" />
          Join the Mailing List
        </motion.a>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="px-5 pb-20 sm:px-8">
      <div className="mx-auto max-w-2xl rounded-[26px] border-[3px] border-[#F2ECE0] bg-[#1C1A17] px-8 py-16 text-center shadow-[10px_10px_0_0_#E0492F]">
        <div className="font-display-poster text-7xl font-extrabold text-[#FF6A4D]">
          !
        </div>
        <h2 className="font-display-poster mt-3 text-4xl font-extrabold uppercase tracking-tight text-[#F8F3EA]">
          Between speakers
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg font-medium text-pretty text-[#C9BFAE]">
          Suggest someone you&rsquo;d love to hear, or join the list to be first
          to know when the next one drops.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <MotionLink
            href={SUGGEST_URL}
            prefetch={false}
            whileHover={{ x: -2, y: -2 }}
            whileTap={{ x: 0, y: 0 }}
            className="inline-flex items-center gap-2 rounded-xl border-[3px] border-[#F2ECE0] bg-[#E0492F] px-6 py-3.5 text-base font-bold text-white shadow-[4px_4px_0_0_#F2ECE0]"
          >
            Suggest a Speaker
            <ArrowUpRightIcon className="size-4" />
          </MotionLink>
          <a
            href={MAILING_LIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border-[3px] border-[#F2ECE0] bg-[#1C1A17] px-6 py-3.5 text-base font-bold text-[#F8F3EA] shadow-[4px_4px_0_0_#F2ECE0]"
          >
            Join the Mailing List
          </a>
        </div>
      </div>
    </section>
  );
}
