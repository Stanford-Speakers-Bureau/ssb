"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { FlatSpeaker } from "./types";

const TRUNCATE_CHARS = 180;

function truncate(text: string, max = TRUNCATE_CHARS) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd() + "…";
}

export function PhotoCard({
  speaker,
  image,
  onOpen,
}: {
  speaker: FlatSpeaker;
  image: string;
  onOpen: () => void;
}) {
  return (
    <motion.button
      layout
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded text-left min-h-[340px] sm:min-h-[420px] focus:outline-none focus:ring-2 focus:ring-[#A80D0C] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black"
    >
      <Image
        src={image}
        alt={`${speaker.name} speaking at Stanford University from Stanford Speakers Bureau (SSB)`}
        fill
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 66vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10" />

      <span className="absolute top-4 right-4 rounded-full bg-[#A80D0C] px-3 py-1 text-xs font-sans uppercase tracking-widest text-white">
        {speaker.year}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
        <h3 className="font-serif text-3xl sm:text-4xl font-bold text-white leading-[0.95] mb-2">
          {speaker.name}
        </h3>
        {speaker.title && (
          <p className="font-sans text-sm sm:text-base italic text-zinc-200 mb-3">
            {speaker.title}
          </p>
        )}
        <p className="font-sans text-sm text-zinc-100 leading-relaxed line-clamp-2 opacity-0 translate-y-2 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0">
          {truncate(speaker.bio, 160)}
        </p>
      </div>
    </motion.button>
  );
}

export function TypeCard({
  speaker,
  onOpen,
}: {
  speaker: FlatSpeaker;
  onOpen: () => void;
}) {
  return (
    <motion.button
      layout
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded border border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950 text-left min-h-[340px] sm:min-h-[420px] p-7 sm:p-9 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/40 hover:border-[#A80D0C]/60 focus:outline-none focus:ring-2 focus:ring-[#A80D0C] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black"
    >
      {/* Cardinal sweep */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-0 bg-[#A80D0C] transition-all duration-500 ease-out group-hover:w-1.5"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[2px] bg-[#A80D0C]/70 group-hover:opacity-0 transition-opacity"
      />

      {/* Year tag */}
      <span className="absolute top-5 right-5 font-sans text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
        {speaker.year}
      </span>

      <div className="relative h-full flex flex-col justify-between transition-transform duration-500 group-hover:translate-x-1">
        <div>
          <h3 className="font-serif text-3xl sm:text-[2.5rem] font-bold text-black dark:text-white leading-[0.95] mb-3 pr-10">
            {speaker.name}
          </h3>
          {speaker.title && (
            <p className="font-sans text-[11px] sm:text-xs uppercase tracking-[0.15em] text-[#A80D0C] mb-5">
              {speaker.title}
            </p>
          )}
          <p className="font-sans text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-5">
            {truncate(speaker.bio)}
          </p>
        </div>

        <span className="mt-6 inline-flex items-center gap-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500 group-hover:text-[#A80D0C] transition-colors">
          Read more
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:translate-x-1"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </div>
    </motion.button>
  );
}
