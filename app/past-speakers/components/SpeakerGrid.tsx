"use client";

import { AnimatePresence, motion } from "motion/react";
import type { FlatSpeaker } from "./types";
import { PhotoCard, TypeCard } from "./SpeakerCard";

export default function SpeakerGrid({
  speakers,
  images,
  onOpen,
}: {
  speakers: FlatSpeaker[];
  images: Record<string, string>;
  onOpen: (slug: string) => void;
}) {
  if (speakers.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 sm:px-12 py-24 text-center">
        <p className="font-serif text-2xl text-zinc-500 dark:text-zinc-400 mb-2">
          No speakers match that search.
        </p>
        <p className="font-sans text-sm text-zinc-400 dark:text-zinc-500">
          Try a different name, title, or year.
        </p>
      </div>
    );
  }

  let typeCardIndex = 0;

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-12 py-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-fr">
        <AnimatePresence mode="popLayout">
          {speakers.map((speaker) => {
            const image = images[speaker.slug];
            const isPhoto = Boolean(image);
            const isWide = !isPhoto && typeCardIndex % 5 === 4;
            if (!isPhoto) typeCardIndex++;
            const span = isPhoto
              ? "sm:col-span-2 sm:row-span-2"
              : isWide
                ? "sm:col-span-2"
                : "";

            return (
              <motion.div
                key={speaker.slug}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={span}
              >
                {isPhoto ? (
                  <PhotoCard
                    speaker={speaker}
                    image={image}
                    onOpen={() => onOpen(speaker.slug)}
                  />
                ) : (
                  <TypeCard
                    speaker={speaker}
                    onOpen={() => onOpen(speaker.slug)}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
