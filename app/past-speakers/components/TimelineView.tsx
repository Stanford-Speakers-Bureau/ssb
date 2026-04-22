"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { FlatSpeaker } from "./types";

type YearSection = {
  year: string;
  speakers: FlatSpeaker[];
};

export default function TimelineView({
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
        <p className="font-serif text-2xl text-zinc-500 dark:text-zinc-400">
          No speakers match that search.
        </p>
      </div>
    );
  }

  return (
    <div className="relative max-w-5xl mx-auto px-6 sm:px-12 py-16">
      {/* Center spine */}
      <div
        aria-hidden="true"
        className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#A80D0C]/40 to-transparent"
      />

      {sections.map((section) => {
        if (section.speakers.length === 0) return null;
        return (
          <section key={section.year} className="relative mb-20 last:mb-0">
            {/* Giant year marker */}
            <div className="relative flex justify-center mb-12">
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="block font-serif text-[7rem] sm:text-[12rem] leading-none text-transparent"
                  style={{
                    WebkitTextStroke: "2px #A80D0C",
                  }}
                >
                  {section.year}
                </span>
                <span className="sr-only">{section.year}</span>
              </div>
            </div>

            <div className="space-y-12">
              {section.speakers.map((speaker, i) => {
                const image = images[speaker.slug];
                const isLeft = i % 2 === 0;
                return (
                  <motion.div
                    key={speaker.slug}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`relative md:w-1/2 ${
                      isLeft ? "md:pr-10" : "md:ml-auto md:pl-10"
                    }`}
                  >
                    {/* Dot on spine */}
                    <div
                      aria-hidden="true"
                      className={`hidden md:block absolute top-6 h-3 w-3 rounded-full bg-[#A80D0C] ${
                        isLeft ? "-right-[7px]" : "-left-[7px]"
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => onOpen(speaker.slug)}
                      className="group block w-full text-left rounded border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 sm:p-8 transition-all hover:border-[#A80D0C] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#A80D0C]"
                    >
                      {image && (
                        <div className="relative w-full h-56 mb-5 rounded overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                          <Image
                            src={image}
                            alt={`${speaker.name} speaking at Stanford University from Stanford Speakers Bureau (SSB)`}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, 50vw"
                          />
                        </div>
                      )}
                      <h3 className="font-serif text-2xl sm:text-3xl text-black dark:text-white leading-tight mb-2">
                        {speaker.name}
                      </h3>
                      {speaker.title && (
                        <p className="font-sans text-xs uppercase tracking-[0.15em] text-[#A80D0C] mb-3">
                          {speaker.title}
                        </p>
                      )}
                      <p className="font-sans text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-4">
                        {speaker.bio}
                      </p>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
