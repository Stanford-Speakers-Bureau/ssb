"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import type { FlatSpeaker } from "./types";

const AUTOPLAY_INTERVAL_MS = 6000;

type SpotlightSpeaker = FlatSpeaker & { image: string, spotlightImage?: string };

function Slide({
  speaker,
  onOpen,
}: {
  speaker: SpotlightSpeaker;
  onOpen: (slug: string) => void;
}) {
  const pullQuote = speaker.bio.split(". ").slice(0, 2).join(". ") + ".";
  return (
    <button
      type="button"
      onClick={() => onOpen(speaker.slug)}
      className="group relative block h-[300px] sm:h-[60vh] sm:min-h-[420px] w-full overflow-hidden rounded text-left"
    >
      <Image
        src={speaker.spotlightImage ?? speaker.image}
        alt={`${speaker.name} speaking at Stanford University from Stanford Speakers Bureau (SSB)`}
        fill
        priority
        className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/10" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-14">
        <div className="max-w-3xl">
          <span className="inline-block mb-3 sm:mb-4 rounded-full bg-[#A80D0C] px-3 py-1 text-[10px] sm:text-xs font-sans uppercase tracking-[0.2em] text-white">
            {speaker.year} · {speaker.location ?? "Stanford"}
          </span>
          <h2 className="font-serif text-3xl sm:text-6xl text-white leading-[0.95] mb-2 sm:mb-3">
            {speaker.name}
          </h2>
          {speaker.title && (
            <p className="font-sans text-sm sm:text-lg italic text-zinc-200 mb-3 sm:mb-4">
              {speaker.title}
            </p>
          )}
          <p className="hidden sm:block font-sans text-sm sm:text-base text-zinc-100 leading-relaxed max-w-2xl line-clamp-3">
            {pullQuote}
          </p>
          <span className="mt-1.5 sm:mt-5 inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-sans sm:font-semibold uppercase sm:normal-case tracking-[0.2em] sm:tracking-normal text-white/80 sm:text-white underline-offset-4 group-hover:underline">
            Read the full story
            <svg
              width="12"
              height="12"
              className="sm:hidden"
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
            <svg
              className="hidden sm:block"
              width="18"
              height="18"
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
          </span>
        </div>
      </div>
    </button>
  );
}

function Arrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous spotlight" : "Next spotlight"}
      className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-20 h-12 w-12 items-center justify-center rounded-full bg-[#A80D0C] text-white shadow-lg transition-all hover:bg-[#C11211] ${direction === "prev" ? "-left-4 lg:-left-8" : "-right-4 lg:-right-8"
        }`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {direction === "prev" ? (
          <path d="m15 18-6-6 6-6" />
        ) : (
          <path d="m9 18 6-6-6-6" />
        )}
      </svg>
    </button>
  );
}

export default function SpeakerSpotlight({
  speakers,
  onOpen,
}: {
  speakers: SpotlightSpeaker[];
  onOpen: (slug: string) => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: true,
    slidesToScroll: 1,
    containScroll: "trimSnaps",
  });
  const [selected, setSelected] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!emblaApi) return;
    const handle = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", handle);
    emblaApi.on("reInit", handle);
    const raf = requestAnimationFrame(handle);
    return () => {
      cancelAnimationFrame(raf);
      emblaApi.off("select", handle);
      emblaApi.off("reInit", handle);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const interval = window.setInterval(() => {
      if (pausedRef.current || document.hidden) return;
      emblaApi.scrollNext();
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    pausedRef.current = true;
    emblaApi?.scrollPrev();
  }, [emblaApi]);
  const scrollNext = useCallback(() => {
    pausedRef.current = true;
    emblaApi?.scrollNext();
  }, [emblaApi]);
  const scrollTo = useCallback(
    (i: number) => {
      pausedRef.current = true;
      emblaApi?.scrollTo(i);
    },
    [emblaApi],
  );

  return (
    <section
      className="relative border-y border-zinc-900 bg-black"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      <div className="max-w-6xl mx-auto px-6 sm:px-12 py-12 sm:py-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-2">
              In Focus
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-white">
              Spotlight
            </h2>
          </div>
          <p className="hidden sm:block text-sm text-zinc-400">
            {selected + 1} / {speakers.length}
          </p>
        </div>

        <div className="relative">
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex touch-pan-y">
              {speakers.map((speaker) => (
                <div
                  key={speaker.slug}
                  className="min-w-0 flex-[0_0_100%] pr-0"
                >
                  <Slide speaker={speaker} onOpen={onOpen} />
                </div>
              ))}
            </div>
          </div>
          <Arrow direction="prev" onClick={scrollPrev} />
          <Arrow direction="next" onClick={scrollNext} />

          <div className="mt-3 sm:mt-6 flex justify-center gap-2">
            {speakers.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Go to spotlight ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === selected
                  ? "w-8 bg-[#A80D0C]"
                  : "w-4 bg-zinc-600 hover:bg-zinc-400"
                  }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
