"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRightIcon,
  BellIcon,
  CalendarIcon,
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
 * MIDNIGHT ARCADE — playful dark, neon glow + glass.
 * Inky plum-black, cardinal red anchor that glows, with violet / magenta /
 * gold accents. Expressive grotesque display (Space Grotesk). Bouncy + pulse.
 * ======================================================================== */

const MotionLink = motion.create(Link);

const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-white/85 backdrop-blur-md";

export default function ArcadeTheme({
  vms,
  hasEvents,
  isLoggedIn,
}: ThemeProps) {
  return (
    <div className="min-h-screen bg-[#120E16] font-sans text-[#F4ECF5]">
      <Hero hasEvents={hasEvents} />

      {hasEvents ? (
        <section className="px-5 pb-20 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-10">
            {vms.map((vm, i) =>
              vm.mystery ? (
                <MysteryCard
                  key={vm.id}
                  vm={vm}
                  isLoggedIn={isLoggedIn}
                  index={i}
                />
              ) : (
                <RevealedCard key={vm.id} vm={vm} index={i} />
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
    <section className="relative overflow-hidden px-5 pt-32 pb-16 text-center sm:px-8 sm:pt-40">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_30%_0%,rgba(224,73,47,0.32),transparent_55%),radial-gradient(ellipse_at_75%_10%,rgba(139,92,246,0.28),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-3xl">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#C9B8FF] backdrop-blur-md"
        >
          <SparkleIcon className="size-4" />
          {hasEvents ? "On the calendar" : "Between events"}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.05 }}
          className="font-display-arcade mt-6 text-5xl font-bold tracking-tight text-balance sm:text-7xl"
        >
          {hasEvents ? (
            <>
              Up{" "}
              <span className="bg-gradient-to-r from-[#FF7A45] via-[#E0492F] to-[#F0398B] bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(224,73,47,0.45)]">
                next
              </span>{" "}
              on the SSB stage.
            </>
          ) : (
            <>Nothing on the calendar yet.</>
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.1 }}
          className="mx-auto mt-5 max-w-xl text-lg text-pretty text-[#B5A8BD]"
        >
          {hasEvents
            ? "We can't wait to welcome you to the next one. Hop on the mailing list so you never miss a drop."
            : "We're between speakers. Drop a name on the suggest list or join the mailing list — you'll be first to know."}
        </motion.p>
      </div>
    </section>
  );
}

function RevealedCard({ vm, index }: { vm: SpeakerCardVM; index: number }) {
  const left = ticketsLeft(vm);
  const lowStock = left != null && left > 0 && left <= 80;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ ...SPRING, delay: index * 0.05 }}
      whileHover={{ y: -6 }}
      className="group overflow-hidden rounded-[28px] border border-white/10 bg-[#1B1422] shadow-[0_30px_80px_-34px_rgba(224,73,47,0.6)]"
    >
      <div className="relative aspect-[2/1] overflow-hidden bg-[#221829]">
        {vm.imageUrl && (
          <Image
            src={vm.imageUrl}
            alt={vm.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 900px"
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1B1422] via-[#1B1422]/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 sm:p-7">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E0492F]/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-[0_0_24px_rgba(224,73,47,0.6)]">
            <CalendarIcon className="size-3.5" />
            {vm.dateText || "Coming soon"}
          </span>
          <h2 className="font-display-arcade text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-5xl">
            {vm.name}
          </h2>
        </div>
      </div>

      <div className="p-6 sm:p-7">
        {vm.header && (
          <Markdown className="text-base leading-relaxed text-pretty text-[#B5A8BD] [&_a]:text-[#FF7A45] [&_a]:underline [&_p]:m-0">
            {vm.header}
          </Markdown>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {vm.doorsOpenText && (
            <span className={PILL}>
              <DoorIcon className="size-4 text-[#FF7A45]" />
              {vm.doorsOpenText}
            </span>
          )}
          {vm.eventTimeText && (
            <span className={PILL}>
              <ClockIcon className="size-4 text-[#FF7A45]" />
              {vm.eventTimeText}
            </span>
          )}
          {vm.locationName &&
            (vm.locationUrl ? (
              <a
                href={vm.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${PILL} hover:bg-white/10`}
              >
                <PinIcon className="size-4 text-[#FF7A45]" />
                {vm.locationName}
              </a>
            ) : (
              <span className={PILL}>
                <PinIcon className="size-4 text-[#FF7A45]" />
                {vm.locationName}
              </span>
            ))}
          {lowStock && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E0492F]/15 px-3 py-1.5 text-sm font-semibold text-[#FF7A45] tabular-nums">
              <TicketIcon className="size-4" />
              Only {left} left
            </span>
          )}
        </div>

        {vm.ctaText && vm.ctaHref && (
          <MotionLink
            href={vm.ctaHref}
            prefetch={false}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#B51F1A] to-[#E0492F] py-3.5 text-base font-semibold text-white shadow-[0_0_30px_-4px_rgba(224,73,47,0.7)]"
          >
            <TicketIcon className="size-5" />
            {vm.ctaText}
            <ArrowRightIcon className="size-4" />
          </MotionLink>
        )}
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
      className="relative flex flex-col items-center overflow-hidden rounded-[28px] border border-white/10 bg-[#1B1422] px-6 py-12 text-center shadow-[0_30px_80px_-34px_rgba(139,92,246,0.6)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(224,73,47,0.22),transparent_60%)]"
      />
      <div className="relative flex flex-col items-center">
        <div className="relative">
          <motion.div
            aria-hidden="true"
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.15, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 -z-10 rounded-full bg-[#E0492F]/40 blur-2xl"
          />
          <div className="font-display-arcade text-8xl font-bold text-[#FF7A45] drop-shadow-[0_0_30px_rgba(224,73,47,0.6)]">
            ?
          </div>
        </div>
        <h2 className="font-display-arcade mt-3 text-3xl font-bold tracking-tight text-white">
          Speaker to be announced
        </h2>
        {vm.dateText && (
          <p className="mt-1 text-base font-medium text-[#B5A8BD]">
            {vm.dateText}
          </p>
        )}

        {parts && (
          <div className="mt-6 flex items-end gap-2">
            {countdownSegments(parts).map((seg) => (
              <div key={seg.label} className="flex flex-col items-center">
                <div className="flex min-w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-2.5 py-2 backdrop-blur-md">
                  <span className="text-2xl font-bold tabular-nums text-white">
                    {String(seg.value).padStart(2, "0")}
                  </span>
                </div>
                <span className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-[#B5A8BD]">
                  {seg.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-7">
          {status === "success" ? (
            <p className="text-base font-semibold text-[#4ade80]">{message}</p>
          ) : status === "error" ? (
            <div className="flex items-center gap-3">
              <p className="text-base text-[#FF7A45]">{message}</p>
              <button
                onClick={notify}
                className="text-base font-semibold text-white underline"
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
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#B51F1A] to-[#E0492F] px-6 py-3 text-base font-semibold text-white shadow-[0_0_30px_-4px_rgba(224,73,47,0.7)] disabled:opacity-70"
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
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-[#1B1422] px-8 py-14 text-center sm:px-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(240,57,139,0.2),transparent_60%)]"
        />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#C9B8FF]">
            Don&rsquo;t see them?
          </p>
          <h2 className="font-display-arcade mx-auto mt-3 max-w-xl text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
            Suggest a speaker.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-[#B5A8BD]">
            Drop a name. Top picks become the outreach list for our booking team
            — your suggestion is what fills the calendar.
          </p>
          <MotionLink
            href={SUGGEST_URL}
            prefetch={false}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.96 }}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#B51F1A] to-[#E0492F] px-7 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_-4px_rgba(224,73,47,0.7)]"
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
      <div className="mx-auto flex max-w-5xl flex-col items-center rounded-[32px] border border-white/10 bg-[#1B1422] px-8 py-14 text-center sm:px-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C04A]">
          Stay in the loop
        </p>
        <h2 className="font-display-arcade mt-3 max-w-xl text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
          Hear about every speaker.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-[#B5A8BD]">
          One email per event. No spam — just who&rsquo;s coming and when tickets
          drop.
        </p>
        <motion.a
          href={MAILING_LIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.96 }}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/[0.06] px-7 py-3.5 text-base font-semibold text-white backdrop-blur-md"
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
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-[#1B1422] px-8 py-16 text-center">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgba(224,73,47,0.22),transparent_60%)]"
        />
        <div className="relative">
          <div className="font-display-arcade text-7xl font-bold text-[#FF7A45] drop-shadow-[0_0_30px_rgba(224,73,47,0.5)]">
            ?
          </div>
          <h2 className="font-display-arcade mt-3 text-4xl font-bold tracking-tight text-white">
            We&rsquo;re between speakers.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-pretty text-[#B5A8BD]">
            Suggest someone you&rsquo;d love to hear, or join the list to be
            first to know when the next one drops.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <MotionLink
              href={SUGGEST_URL}
              prefetch={false}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="rounded-2xl bg-gradient-to-r from-[#B51F1A] to-[#E0492F] px-6 py-3.5 text-base font-semibold text-white shadow-[0_0_30px_-4px_rgba(224,73,47,0.7)]"
            >
              Suggest a Speaker
            </MotionLink>
            <a
              href={MAILING_LIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-white/20 bg-white/[0.06] px-6 py-3.5 text-base font-semibold text-white backdrop-blur-md"
            >
              Join the Mailing List
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
