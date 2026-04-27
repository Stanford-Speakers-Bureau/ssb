"use client";

import { motion, useReducedMotion } from "motion/react";

const EASE = [0.2, 0.8, 0.2, 1] as const;

export default function HighlightedName({ name }: { name: string }) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !prefersReducedMotion;

  return (
    <span className="relative isolate inline-block px-[0.07em] font-bold leading-[1.04] align-baseline text-[#A80D0C] drop-shadow-[0_0_28px_rgba(168,13,12,0.24)]">
      <motion.span
        aria-hidden
        initial={shouldAnimate ? { scaleX: 0 } : false}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.64, delay: 0.28, ease: EASE }}
        style={{ transformOrigin: "left center" }}
        className="absolute -inset-x-[0.05em] top-[0.08em] bottom-[0.04em] z-0 rounded-[0.04em] bg-[#A80D0C] shadow-[0_0.06em_0_rgba(255,255,255,0.1)_inset,0_0.12em_0_rgba(168,13,12,0.14)] will-change-transform [clip-path:polygon(0_9%,97%_0,100%_14%,100%_90%,3%_100%,0_88%)]"
      />
      <span className="relative z-10 text-[#A80D0C]">{name}</span>
      <motion.span
        aria-hidden
        initial={shouldAnimate ? { clipPath: "inset(0 100% 0 0)" } : false}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 0.58, delay: 0.34, ease: EASE }}
        className="pointer-events-none absolute inset-x-[0.07em] inset-y-0 z-20 overflow-hidden text-white will-change-[clip-path]"
      >
        {name}
      </motion.span>
    </span>
  );
}
