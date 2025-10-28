"use client";

import { motion } from "motion/react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-stretch bg-zinc-50 font-sans dark:bg-black">
      <section className="relative w-full aspect-[16/10]">
        <Image
          className="object-cover"
          src="/john-green.jpg"
          alt="Hero image"
          priority
          fill
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/70 pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 px-6 sm:px-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold drop-shadow-2xl text-center text-[#d43d3d] font-serif">
              Stanford Speakers Bureau
            </h1>
            <p className="text-gray-300 text-base sm:text-lg md:text-xl max-w-3xl text-center drop-shadow-lg">
              Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.
            </p>
            <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="https://mailman.stanford.edu/mailman/listinfo/ssb-announce" target="_blank" rel="noopener noreferrer" className="rounded-full px-6 py-3 text-base font-semibold text-white transition-colors shadow-lg" style={{ background: '#d43d3d' }}>
                Join Our Mailing List
            </motion.a>
          </div>
        </div>
      </section>
      <main className="flex w-full justify-center bg-white dark:bg-black">
       
      </main>
    </div>
  );
}
