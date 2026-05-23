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
  SparkleIcon,
  Spinner,
  SOFT_SPRING,
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
 * EMBER — warm dark, editorial & cozy.
 * Espresso near-black, cream ink, cardinal red anchor + amber glow.
 * Friendly soft serif (Fraunces), big rounded feature card, soft glow, springy.
 * Built around a single featured speaker (stacks gracefully if there are more).
 * ======================================================================== */

const MotionLink = motion.create(Link);

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border border-[#F3E7DC]/10 bg-[#F3E7DC]/[0.04] px-3 py-1.5 text-sm font-medium text-[#E7D8CB]";

export default function EmberTheme({ vms, hasEvents, isLoggedIn }: ThemeProps) {
  return (
    <div className="min-h-screen bg-[#161210] font-sans text-[#F3E7DC]">
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
    <section className="relative overflow-hidden px-5 pt-32 pb-12 text-center sm:px-8 sm:pt-40">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(232,163,61,0.18),transparent_58%),radial-gradient(ellipse_at_20%_8%,rgba(224,73,47,0.22),transparent_50%)]"
      />
      <div className="relative mx-auto max-w-3xl">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SOFT_SPRING}
          className="inline-flex items-center gap-2 rounded-full border border-[#E8A33D]/30 bg-[#E8A33D]/[0.12] px-4 py-2 text-sm font-semibold tracking-wide text-[#E8A33D]"
        >
          <SparkleIcon className="size-4" />
          {hasEvents ? "On the calendar" : "Between events"}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SOFT_SPRING, delay: 0.06 }}
          className="font-display-soft mt-6 text-5xl tracking-tight text-balance sm:text-7xl"
        >
          {hasEvents ? (
            <>
              Up{" "}
              <span className="relative inline-block text-[#E0492F]">
                next
                <svg
                  viewBox="0 0 120 16"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute -bottom-2 left-0 h-3 w-full text-[#E8A33D]"
                >
                  <path
                    d="M3 11C28 4 92 4 117 9"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              on the SSB stage.
            </>
          ) : (
            <>Nothing on the calendar — yet.</>
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SOFT_SPRING, delay: 0.12 }}
          className="mx-auto mt-5 max-w-xl text-lg text-pretty text-[#B9A79B]"
        >
          {hasEvents
            ? "We can't wait to welcome you to our next event. Hop on the mailing list so you never miss a drop."
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
      transition={{ ...SOFT_SPRING, delay: index * 0.06 }}
      whileHover={{ y: -5 }}
      className="group grid overflow-hidden rounded-[28px] border border-[#F3E7DC]/10 bg-[#1E1714] shadow-[0_40px_90px_-40px_rgba(224,73,47,0.45)] lg:grid-cols-2"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#241B17] lg:aspect-auto lg:min-h-[26rem]">
        {vm.imageUrl && (
          <Image
            src={vm.imageUrl}
            alt={vm.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 600px"
            priority
            unoptimized
          />
        )}
      </div>

      <div className="flex flex-col justify-center p-7 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#E8A33D]">
          Up next{vm.dateText ? ` · ${vm.dateText}` : ""}
        </p>
        <h2 className="font-display-soft mt-2 text-5xl tracking-tight text-balance text-[#F6EFE7] sm:text-6xl">
          {vm.name}
        </h2>
        {vm.header && (
          <Markdown className="mt-3 text-lg leading-relaxed text-pretty text-[#B9A79B] [&_a]:text-[#E0492F] [&_a]:underline [&_p]:m-0">
            {vm.header}
          </Markdown>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {vm.doorsOpenText && (
            <span className={CHIP}>
              <DoorIcon className="size-4 text-[#E8A33D]" />
              {vm.doorsOpenText}
            </span>
          )}
          {vm.eventTimeText && (
            <span className={CHIP}>
              <ClockIcon className="size-4 text-[#E8A33D]" />
              {vm.eventTimeText}
            </span>
          )}
          {vm.locationName &&
            (vm.locationUrl ? (
              <a
                href={vm.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${CHIP} hover:bg-[#F3E7DC]/[0.08]`}
              >
                <PinIcon className="size-4 text-[#E8A33D]" />
                {vm.locationName}
              </a>
            ) : (
              <span className={CHIP}>
                <PinIcon className="size-4 text-[#E8A33D]" />
                {vm.locationName}
              </span>
            ))}
        </div>

        {vm.ctaText && vm.ctaHref && (
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <MotionLink
              href={vm.ctaHref}
              prefetch={false}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#C2261C] to-[#E0492F] px-7 py-3.5 text-base font-semibold text-white shadow-[0_18px_40px_-14px_rgba(224,73,47,0.8)]"
            >
              <TicketIcon className="size-5" />
              {vm.ctaText}
              <ArrowRightIcon className="size-4" />
            </MotionLink>
            {lowStock && (
              <span className="text-sm font-semibold text-[#E8A33D] tabular-nums">
                Only {left} seats left
              </span>
            )}
          </div>
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
      transition={{ ...SOFT_SPRING, delay: index * 0.06 }}
      className="relative flex flex-col items-center overflow-hidden rounded-[28px] border border-[#F3E7DC]/10 bg-[#1E1714] px-6 py-14 text-center"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(232,163,61,0.16),transparent_60%)]"
      />
      <div className="relative flex flex-col items-center">
        <SparkleIcon className="absolute -left-2 top-2 size-5 text-[#E8A33D]" />
        <motion.div
          animate={{ rotate: [-4, 4, -4] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="font-display-soft text-8xl leading-none text-[#E0492F]"
        >
          ?
        </motion.div>
        <h2 className="font-display-soft mt-3 text-3xl tracking-tight text-[#F6EFE7]">
          Speaker to be announced
        </h2>
        {vm.dateText && (
          <p className="mt-1 text-base font-medium text-[#B9A79B]">
            {vm.dateText}
          </p>
        )}

        {parts && (
          <div className="mt-6 flex items-end gap-2">
            {countdownSegments(parts).map((seg) => (
              <div key={seg.label} className="flex flex-col items-center">
                <div className="flex min-w-14 items-center justify-center rounded-2xl border border-[#F3E7DC]/10 bg-[#F3E7DC]/[0.05] px-2.5 py-2">
                  <span className="text-2xl font-bold tabular-nums text-[#F6EFE7]">
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
              <p className="text-base text-[#E0492F]">{message}</p>
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
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#C2261C] to-[#E0492F] px-6 py-3 text-base font-semibold text-white shadow-[0_18px_40px_-14px_rgba(224,73,47,0.8)] disabled:opacity-70"
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
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-[#F3E7DC]/10 bg-[#1E1714] px-8 py-14 text-center sm:px-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(232,163,61,0.14),transparent_60%)]"
        />
        <div className="relative">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#E8A33D]">
            Don&rsquo;t see them?
          </p>
          <h2 className="font-display-soft mx-auto mt-3 max-w-xl text-4xl tracking-tight text-balance text-[#F6EFE7] sm:text-5xl">
            Suggest a speaker.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-[#B9A79B]">
            Drop a name. Top picks become the outreach list for our booking team
            — your suggestion is what fills the calendar.
          </p>
          <MotionLink
            href={SUGGEST_URL}
            prefetch={false}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.96 }}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#C2261C] to-[#E0492F] px-7 py-3.5 text-base font-semibold text-white shadow-[0_18px_40px_-14px_rgba(224,73,47,0.8)]"
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
      <div className="mx-auto flex max-w-5xl flex-col items-center rounded-[32px] border border-[#F3E7DC]/10 bg-[#1E1714] px-8 py-14 text-center sm:px-12">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#E8A33D]">
          Stay in the loop
        </p>
        <h2 className="font-display-soft mt-3 max-w-xl text-4xl tracking-tight text-balance text-[#F6EFE7] sm:text-5xl">
          Hear about every speaker.
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
          className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-[#E8A33D]/40 px-7 py-3.5 text-base font-semibold text-[#E8A33D]"
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
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[32px] border border-[#F3E7DC]/10 bg-[#1E1714] px-8 py-16 text-center">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgba(232,163,61,0.16),transparent_60%)]"
        />
        <div className="relative">
          <div className="font-display-soft text-7xl text-[#E8A33D]">☾</div>
          <h2 className="font-display-soft mt-4 text-4xl tracking-tight text-[#F6EFE7]">
            We&rsquo;re between speakers.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-pretty text-[#B9A79B]">
            Suggest someone you&rsquo;d love to hear, or join the list to be
            first to know when the next one drops.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <MotionLink
              href={SUGGEST_URL}
              prefetch={false}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="rounded-2xl bg-gradient-to-r from-[#C2261C] to-[#E0492F] px-6 py-3.5 text-base font-semibold text-white shadow-[0_18px_40px_-14px_rgba(224,73,47,0.8)]"
            >
              Suggest a Speaker
            </MotionLink>
            <a
              href={MAILING_LIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-[#E8A33D]/40 px-6 py-3.5 text-base font-semibold text-[#E8A33D]"
            >
              Join the Mailing List
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
