"use client";

import { motion } from "motion/react";
import Link from "next/link";

const MotionLink = motion.create(Link);

export function SuggestSpeakerButton({
  label = "Suggest a Speaker",
}: {
  label?: string;
}) {
  return (
    <MotionLink
      href="/suggest"
      prefetch={false}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#b51f1a] to-[#db4c3a] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(181,31,26,0.35)] transition-all hover:-translate-y-0.5 hover:from-[#c62720] hover:to-[#eb6a56] sm:text-base"
    >
      {label}
    </MotionLink>
  );
}
