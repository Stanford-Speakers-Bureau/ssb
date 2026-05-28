"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { FlatSpeaker } from "./types";

type YearSection = {
  year: string;
  speakers: FlatSpeaker[];
};

export default function SpeakerExpanded({
  sections,
  images,
  onOpen,
}: {
  sections: YearSection[];
  images: Record<string, string>;
  onOpen: (slug: string) => void;
}) {
  if (sections.every((s) => s.speakers.length === 0)) {
    return (
      <div className="max-w-6xl mx-auto px-6 sm:px-12 py-24 text-center">
        <p className="font-serif text-2xl text-zinc-400">
          No speakers match that search.
        </p>
      </div>
    );
  }

  const indexedSections = sections.map((section, sectionIndex) => {
    const previousSpeakerCount = sections
      .slice(0, sectionIndex)
      .reduce((sum, previous) => sum + previous.speakers.length, 0);

    return {
      ...section,
      speakers: section.speakers.map((speaker, index) => ({
        speaker,
        globalIndex: previousSpeakerCount + index,
      })),
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-12 py-12 sm:py-16">
      {indexedSections.map((section) => {
        if (section.speakers.length === 0) return null;
        return (
          <section key={section.year} className="mb-16 last:mb-0">
            <div className="flex items-baseline gap-4 mb-6">
              <h2 className="font-serif text-4xl sm:text-5xl text-white">
                {section.year}
              </h2>
              <span className="h-px flex-1 bg-zinc-800" />
            </div>

            <div className="space-y-6">
              {section.speakers.map(({ speaker, globalIndex }) => {
                const image = images[speaker.slug];
                const reverse = globalIndex % 2 === 1;
                return (
                  <ExpandedCard
                    key={speaker.slug}
                    speaker={speaker}
                    image={image}
                    reverse={reverse}
                    onOpen={onOpen}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ExpandedCard({
  speaker,
  image,
  reverse,
  onOpen,
}: {
  speaker: FlatSpeaker;
  image?: string;
  reverse: boolean;
  onOpen: (slug: string) => void;
}) {
  const hasMeta = Boolean(speaker.month || speaker.location);

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950"
    >
      <div
        className={`grid ${image ? "md:grid-cols-2" : "grid-cols-1"} ${
          image && reverse ? "md:[&>div:first-child]:order-2" : ""
        }`}
      >
        {image && (
          <div className="relative h-72 md:h-[420px] bg-zinc-900 overflow-hidden">
            <Image
              src={image}
              alt={`${speaker.name} speaking at Stanford University from Stanford Speakers Bureau (SSB)`}
              fill
              className="object-cover object-[50%_calc(50%+5px)] transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {hasMeta && (
              <div className="absolute top-4 left-4 rounded-md bg-black/70 backdrop-blur-sm px-3 py-2">
                {speaker.month && (
                  <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/70 leading-none">
                    {speaker.month}
                  </p>
                )}
                {speaker.location && (
                  <p className="font-sans text-sm font-semibold text-white leading-tight mt-0.5">
                    {speaker.location}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col justify-center p-6 sm:p-10">
          {!image && hasMeta && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
              {speaker.month && (
                <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-white/60">
                  {speaker.month}
                </span>
              )}
              {speaker.location && (
                <span className="font-sans text-sm font-semibold text-white/90">
                  {speaker.location}
                </span>
              )}
            </div>
          )}
          <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white leading-[1.05] mb-3">
            {speaker.name}
          </h3>
          {speaker.title && (
            <p className="font-serif italic text-base sm:text-lg text-[#D64645] mb-5">
              {speaker.title}
            </p>
          )}
          <span
            aria-hidden="true"
            className="block h-px w-12 bg-[#A80D0C] mb-5"
          />
          <p
            className={`font-sans text-sm sm:text-base text-zinc-300 leading-relaxed mb-6 ${
              image ? "line-clamp-4" : ""
            }`}
          >
            {speaker.bio}
          </p>
          <button
            type="button"
            onClick={() => onOpen(speaker.slug)}
            className="inline-flex items-center gap-2 self-start rounded-md border border-[#A80D0C] px-5 py-2.5 text-sm font-semibold text-[#D64645] transition-colors hover:bg-[#A80D0C] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#A80D0C]"
          >
            View profile
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
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </motion.article>
  );
}
