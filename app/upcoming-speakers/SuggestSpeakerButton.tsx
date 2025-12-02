"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function SuggestSpeakerButton() {
  return (
    <motion.div
    whileHover={{ scale: 1.05 }} 
    whileTap={{ scale: 0.95 }}
  >
    <Link href="/suggest" 
      className="rounded px-5 py-3 text-base font-semibold text-white shadow-lg bg-[#A80D0C] transition-colors hover:bg-[#8B0A0A]">
      Suggest
    </Link>
  </motion.div>
  );
}


