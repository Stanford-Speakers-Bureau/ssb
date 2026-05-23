"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRightIcon,
  BellIcon,
  ClockIcon,
  DoorIcon,
  Markdown,
  MAILING_LIST_URL,
  PinIcon,
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
 * MARQUEE — dark theatre at night. Espresso-kraft canvas, cream ink, glowing
 * gold marquee bulbs, cardinal red anchor. Cards shaped like perforated ticket
 * stubs (dashed seam + punched notches). Condensed display (Anton). Stamp-y.
 * Built around a single featured speaker (stacks gracefully if there are more).
 * ======================================================================== */

const MotionLink = motion.create(Link);

const TAG =
  "inline-flex items-center gap-1.5 rounded-md bg-[#F3E7DC]/[0.06] px-2.5 py-1 text-sm font-medium text-[#D9C9BB]";

function MarqueeBulbs() {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className="size-2 rounded-full bg-[#E0B341] shadow-[0_0_10px_rgba(224,179,65,0.9)]"
        />
      ))}
    </div>
  );
}

export default function MarqueeTheme({
  vms,
  hasEvents,
  isLoggedIn,
}: ThemeProps) {
  return (
    <div className="min-h-screen bg-[#17120F] font-sans text-[#F3E7DC]">
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
    <section className="relative px-5 pt-32 pb-14 text-center sm:px-8 sm:pt-40">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(224,179,65,0.12),transparent_60%)]"
      />
      <div className="relative mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
        >
          <MarqueeBulbs />
        </motion.div>

        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.05 }}
          className="mt-6 inline-block rounded-md border-2 border-[#E0492F] px-4 py-1.5 text-sm font-bold uppercase tracking-[0.25em] text-[#FF6A4D]"
        >
          {hasEvents ? "Now showing" : "Intermission"}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.1 }}
          className="font-marquee mt-5 text-6xl uppercase leading-[0.95] text-balance sm:text-8xl"
        >
          {hasEvents ? (
            <>
              Up <span className="text-[#FF6A4D]">next</span> on the SSB stage
            </>
          ) : (
            <>The stage is dark — for now</>
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.16 }}
          className="mx-auto mt-5 max-w-xl text-lg text-pretty text-[#B9A79B]"
        >
          {hasEvents
            ? "Grab your seat before the lights go down. Get on the mailing list so you never miss a drop."
            : "We're between speakers. Drop a name on the suggest list or join the mailing list — you'll be first to know."}
        </motion.p>
      </div>
    </section>
  );
}

function FeaturedCard({ vm, index }: { vm: SpeakerCardVM; index: number }) {
  const left = ticketsLeft(vm);
  const lowStock = left != null && left > 0 && left <= 80;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ ...SPRING, delay: index * 0.05 }}
      whileHover={{ y: -5 }}
      className="group relative grid rounded-[24px] bg-[#241A15] shadow-[0_36px_70px_-34px_rgba(0,0,0,0.8)] ring-1 ring-[#F3E7DC]/10 sm:grid-cols-[minmax(0,340px)_1fr]"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-[24px] bg-[#2C201A] sm:aspect-auto sm:min-h-[24rem] sm:rounded-l-[24px] sm:rounded-tr-none">
        {vm.imageUrl && (
          <Image
            src={vm.imageUrl}
            alt={vm.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 340px"
            priority
            unoptimized
          />
        )}
      </div>

      {/* content / stub — dashed seam + punched notches (page-coloured) */}
      <div className="relative flex flex-col justify-center border-dashed border-[#F3E7DC]/25 p-6 max-sm:border-t-2 sm:border-l-2 sm:p-9">
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#17120F] max-sm:hidden"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 size-4 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#17120F] max-sm:hidden"
        />

        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#E0B341]">
          Admit one · {vm.dateText || "Coming soon"}
        </p>
        <h2 className="font-marquee mt-2 text-5xl uppercase leading-none text-[#F6EFE7] sm:text-6xl">
          {vm.name}
        </h2>
        {vm.header && (
          <Markdown className="mt-3 text-base leading-relaxed text-pretty text-[#B9A79B] [&_a]:text-[#FF6A4D] [&_a]:underline [&_p]:m-0">
            {vm.header}
          </Markdown>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {vm.doorsOpenText && (
            <span className={TAG}>
              <DoorIcon className="size-4 text-[#E0B341]" />
              {vm.doorsOpenText}
            </span>
          )}
          {vm.eventTimeText && (
            <span className={TAG}>
              <ClockIcon className="size-4 text-[#E0B341]" />
              {vm.eventTimeText}
            </span>
          )}
          {vm.locationName &&
            (vm.locationUrl ? (
              <a
                href={vm.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${TAG} hover:bg-[#F3E7DC]/10`}
              >
                <PinIcon className="size-4 text-[#E0B341]" />
                {vm.locationName}
              </a>
            ) : (
              <span className={TAG}>
                <PinIcon className="size-4 text-[#E0B341]" />
                {vm.locationName}
              </span>
            ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {vm.ctaText && vm.ctaHref && (
            <MotionLink
              href={vm.ctaHref}
              prefetch={false}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E0492F] px-6 py-3 text-base font-bold uppercase tracking-wide text-white shadow-[0_16px_30px_-12px_rgba(224,73,47,0.9)]"
            >
              <TicketIcon className="size-5" />
              {vm.ctaText}
              <ArrowRightIcon className="size-4" />
            </MotionLink>
          )}
          {lowStock && (
            <span className="text-sm font-bold uppercase tracking-wide text-[#FF6A4D] tabular-nums">
              Only {left} seats left
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
      className="relative flex flex-col items-center rounded-[24px] bg-[#241A15] px-6 py-12 text-center shadow-[0_36px_70px_-34px_rgba(0,0,0,0.8)] ring-1 ring-[#F3E7DC]/10"
    >
      <span className="inline-block -rotate-3 rounded-md border-2 border-[#E0B341] px-3 py-1 text-sm font-bold uppercase tracking-[0.2em] text-[#E0B341]">
        Coming soon
      </span>
      <div className="font-marquee mt-4 text-8xl leading-none text-[#FF6A4D]">
        ??
      </div>
      <h2 className="font-marquee mt-1 text-4xl uppercase leading-none text-[#F6EFE7]">
        To be announced
      </h2>
      {vm.dateText && (
        <p className="mt-2 text-base font-medium text-[#B9A79B]">
          {vm.dateText}
        </p>
      )}

      {parts && (
        <div className="mt-6 flex items-end gap-2">
          {countdownSegments(parts).map((seg) => (
            <div key={seg.label} className="flex flex-col items-center">
              <div className="flex min-w-14 items-center justify-center rounded-lg border border-[#F3E7DC]/15 bg-[#17120F] px-2.5 py-2">
                <span className="font-marquee text-3xl tabular-nums text-[#F6EFE7]">
                  {String(seg.value).padStart(2, "0")}
                </span>
              </div>
              <span className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-[#B9A79B]">
                {seg.label}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-7">
        {status === "success" ? (
          <p className="text-base font-semibold text-[#7bd88f]">{message}</p>
        ) : status === "error" ? (
          <div className="flex items-center gap-3">
            <p className="text-base text-[#FF6A4D]">{message}</p>
            <button
              onClick={notify}
              className="text-base font-semibold text-[#F6EFE7] underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <motion.button
            onClick={notify}
            disabled={status === "loading"}
            whileHover={status === "loading" ? undefined : { scale: 1.04 }}
            whileTap={status === "loading" ? undefined : { scale: 0.96 }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E0492F] px-6 py-3 text-base font-bold uppercase tracking-wide text-white shadow-[0_16px_30px_-12px_rgba(224,73,47,0.9)] disabled:opacity-70"
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
    </motion.article>
  );
}

function SuggestSection() {
  return (
    <section className="px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl rounded-[24px] bg-[#B0231C] px-8 py-14 text-center shadow-[0_30px_60px_-30px_rgba(176,35,28,0.8)] sm:px-12">
        <MarqueeBulbs />
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.25em] text-[#F2D38A]">
          Don&rsquo;t see them?
        </p>
        <h2 className="font-marquee mx-auto mt-2 max-w-xl text-5xl uppercase leading-none text-balance text-white sm:text-6xl">
          Suggest a speaker
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-white/85">
          Drop a name. Top picks become the outreach list for our booking team —
          your suggestion is what fills the marquee.
        </p>
        <MotionLink
          href={SUGGEST_URL}
          prefetch={false}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.96 }}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#1A0F0D] px-7 py-3.5 text-base font-bold uppercase tracking-wide text-[#FBE9C8] shadow-md"
        >
          <TicketIcon className="size-5" />
          Suggest a Speaker
        </MotionLink>
      </div>
    </section>
  );
}

function MailingSection() {
  return (
    <section className="px-5 pb-24 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center rounded-[24px] bg-[#241A15] px-8 py-14 text-center shadow-[0_30px_60px_-34px_rgba(0,0,0,0.8)] ring-1 ring-[#F3E7DC]/10 sm:px-12">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#E0B341]">
          Stay in the loop
        </p>
        <h2 className="font-marquee mt-2 max-w-xl text-5xl uppercase leading-none text-balance text-[#F6EFE7] sm:text-6xl">
          Every speaker, front row
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-[#B9A79B]">
          One email per event. No spam — just who&rsquo;s coming and when tickets
          drop.
        </p>
        <motion.a
          href={MAILING_LIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.96 }}
          className="mt-8 inline-flex items-center gap-2 rounded-xl border-2 border-[#E0492F] px-7 py-3.5 text-base font-bold uppercase tracking-wide text-[#FF6A4D]"
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
      <div className="mx-auto max-w-2xl rounded-[24px] bg-[#241A15] px-8 py-16 text-center shadow-[0_30px_60px_-34px_rgba(0,0,0,0.8)] ring-1 ring-[#F3E7DC]/10">
        <span className="inline-block -rotate-3 rounded-md border-2 border-[#E0492F] px-3 py-1 text-sm font-bold uppercase tracking-[0.2em] text-[#FF6A4D]">
          Intermission
        </span>
        <h2 className="font-marquee mt-4 text-5xl uppercase leading-none text-[#F6EFE7]">
          The stage is dark
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-pretty text-[#B9A79B]">
          Suggest someone you&rsquo;d love to hear, or join the list to be first
          to know when the next one drops.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <MotionLink
            href={SUGGEST_URL}
            prefetch={false}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-xl bg-[#E0492F] px-6 py-3.5 text-base font-bold uppercase tracking-wide text-white shadow-[0_16px_30px_-12px_rgba(224,73,47,0.9)]"
          >
            Suggest a Speaker
          </MotionLink>
          <a
            href={MAILING_LIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border-2 border-[#E0492F] px-6 py-3.5 text-base font-bold uppercase tracking-wide text-[#FF6A4D]"
          >
            Join the Mailing List
          </a>
        </div>
      </div>
    </section>
  );
}
