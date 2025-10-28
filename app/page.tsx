"use client";

import { motion } from "motion/react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-stretch bg-zinc-50 font-sans dark:bg-black">
      <section className="relative w-full aspect-[16/10]">
        <nav className="absolute top-0 left-0 right-0 z-50 w-full bg-gradient-to-b from-black/50 to-transparent">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
            <div className="flex items-center gap-8 pt-2">
              <a href="/" className="text-xl font-bold text-white drop-shadow-lg">
                Logo
              </a>
              <div className="hidden items-center gap-6 md:flex">
                <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="/past-speakers" className="text-sm font-medium text-white/90 transition-colors hover:text-white drop-shadow">
                  Past Speakers
                </motion.a>
                <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="/co-sponsorships" className="text-sm font-medium text-white/90 transition-colors hover:text-white drop-shadow">
                  Co-Sponsorships
                </motion.a>
                <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="/team" className="text-sm font-medium text-white/90 transition-colors hover:text-white drop-shadow">
                  Team
                </motion.a>
                <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="/contact" className="text-sm font-medium text-white/90 transition-colors hover:text-white drop-shadow">
                  Contact
                </motion.a>
                <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="https://mailman.stanford.edu/mailman/listinfo/ssb-announce" target="_blank" rel="noopener noreferrer" className="rounded-full px-4 py-2 text-sm font-medium text-white transition-colors" style={{ background: '#d43d3d' }}>
                Join Our Mailing List
              </motion.a>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="/sign-in" className="rounded-full px-4 py-2 text-sm font-medium bg-white text-black" >
                Sign In
              </motion.a>
            </div>
          </div>
        </nav>
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
          </div>
        </div>
      </section>
      <main className="flex w-full justify-center bg-white dark:bg-black">
        <section className="w-full max-w-3xl py-12 px-6 sm:px-16">
          <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
          </div>
          <div className="mt-4 flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
          </div>
        </section>
      </main>
    </div>
  );
}
