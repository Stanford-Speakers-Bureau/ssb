"use client";

import Link from "next/link";
import { motion } from "motion/react";

const MotionLink = motion.create(Link);
const MotionA = motion.a;

const EASE = [0.43, 0.13, 0.23, 0.96] as const;

export default function EmptyEventsState() {
  return (
    <section className="px-6 py-16 sm:py-24 sm:px-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-[var(--ssb-card)] px-8 py-14 text-center shadow-[0_25px_80px_rgba(0,0,0,0.22)] sm:px-12 sm:py-20"
      >
        <p className="mb-4 text-xs font-sans uppercase tracking-[0.3em] text-[#A80D0C]">
          Between events
        </p>
        <h2 className="font-serif text-3xl text-white leading-[1.05] sm:text-5xl">
          We&rsquo;re between speakers.
        </h2>
        <p className="mx-auto mt-5 max-w-xl font-sans text-base leading-relaxed text-[#f5e8dc]/80 sm:text-lg">
          Suggest someone you&rsquo;d love to hear, or join the list to be the
          first to know when the next one drops.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <MotionLink
            href="/suggest"
            prefetch={false}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-full bg-gradient-to-r from-[#b51f1a] to-[#db4c3a] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(181,31,26,0.35)] transition-all hover:-translate-y-0.5 hover:from-[#c62720] hover:to-[#eb6a56] sm:text-base"
          >
            Suggest a Speaker
          </MotionLink>
          <MotionA
            href="https://mailman.stanford.edu/mailman/listinfo/ssb-announce"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-full border border-[#f2ded0]/50 bg-[#fff8f1] px-8 py-3.5 text-sm font-semibold text-[#1c1614] shadow-[0_12px_35px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 hover:bg-white sm:text-base"
          >
            Join the Mailing List
          </MotionA>
        </div>
      </motion.div>
    </section>
  );
}
