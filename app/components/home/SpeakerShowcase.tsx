"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";
import { FEATURED_HOME_SPEAKERS } from "@/app/config/speakers";

type ShowcaseSpeaker = {
  name: string;
  title: string;
  quote: string;
  image: string;
  year: string;
  location?: string;
};

const AUTOPLAY_MS = 6000;

function ArchiveSlide() {
  return (
    <Link
      href="/past-speakers"
      prefetch={false}
      className="relative block h-[500px] sm:h-[560px] w-full overflow-hidden rounded-lg border border-[#A80D0C]/40 bg-gradient-to-br from-[#A80D0C]/20 via-black to-black transition-colors hover:border-[#A80D0C] focus:outline-none focus:ring-2 focus:ring-[#A80D0C]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#A80D0C]/30 blur-3xl"
      />

      <div className="relative h-full flex flex-col justify-between p-6 sm:p-8">
        <div>
          <span className="inline-block mb-6 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-3 py-1 text-[10px] font-sans uppercase tracking-[0.2em] text-white/70">
            Explore more
          </span>
          <h3 className="font-serif text-4xl sm:text-5xl text-white leading-[0.95] mb-4">
            90 years of <span className="text-[#A80D0C]">voices</span> on our stage.
          </h3>
          <p className="font-sans text-sm sm:text-base text-zinc-300 leading-relaxed max-w-sm">
            From Nobel laureates to comedians to sitting mayors — every speaker
            who has graced an SSB stage, searchable by year.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 self-start rounded-full bg-[#A80D0C] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#A80D0C]/30 transition-colors group-hover:bg-[#C11211]">
          Enter The Archive
          <svg
            width="16"
            height="16"
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
    </Link>
  );
}

function Slide({ speaker }: { speaker: ShowcaseSpeaker }) {
  return (
    <div className="relative h-[500px] sm:h-[560px] w-full overflow-hidden rounded-lg">
      <Image
        src={speaker.image}
        alt={`${speaker.name} speaking at Stanford University from Stanford Speakers Bureau (SSB)`}
        fill
        className="object-cover transition-transform duration-700 group-hover:scale-105"
        sizes="(max-width: 640px) 85vw, (max-width: 1024px) 50vw, 33vw"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/10" />

      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
        <span className="inline-block mb-3 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-3 py-1 text-[10px] font-sans uppercase tracking-[0.2em] text-white/70">
          {speaker.year} · {speaker.location ?? "Stanford"}
        </span>
        <h3 className="font-serif text-3xl sm:text-4xl text-white leading-[0.95] mb-2">
          {speaker.name}
        </h3>
        <p className="font-sans text-sm italic text-zinc-300 mb-3">
          {speaker.title}
        </p>
        <p className="font-sans text-sm text-zinc-200 leading-relaxed line-clamp-3">
          {speaker.quote}
        </p>
      </div>
    </div>
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
      aria-label={`${direction === "prev" ? "Previous" : "Next"} speaker`}
      className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-20 h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/20 shadow-lg transition-all hover:bg-[#A80D0C] hover:border-[#A80D0C] ${direction === "prev" ? "left-2" : "right-2"
        }`}
    >
      <svg
        width="20"
        height="20"
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

export default function SpeakerShowcase() {
  const SPEAKERS: ShowcaseSpeaker[] = useMemo(
    () =>
      FEATURED_HOME_SPEAKERS.filter((s) => s.image).map((s) => ({
        name: s.name,
        title: s.title ?? "",
        quote: s.homeFeaturedQuote ?? s.bio,
        image: s.image as string,
        year: s.year,
        location: s.location,
      })),
    [],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: true,
    slidesToScroll: 1,
  });
  const [selected, setSelected] = useState(0);
  const [snapCount, setSnapCount] = useState(SPEAKERS.length);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!emblaApi) return;
    const handle = () => {
      setSelected(emblaApi.selectedScrollSnap());
      setSnapCount(emblaApi.scrollSnapList().length);
    };
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
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    const interval = window.setInterval(() => {
      if (pausedRef.current || document.hidden) return;
      emblaApi.scrollNext();
    }, AUTOPLAY_MS);
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
    <section className="relative bg-black">
      <div className="max-w-6xl mx-auto px-6 sm:px-12 pt-16 sm:pt-20 pb-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-2">
              Featured
            </p>
            <h2 className="font-serif text-3xl sm:text-5xl text-white">
              Who&rsquo;s Spoken at Stanford
            </h2>
          </div>
          <motion.div
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <Link
              href="/past-speakers"
              prefetch={false}
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Explore The Archive
              <svg
                width="16"
                height="16"
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
            </Link>
          </motion.div>
        </div>
      </div>

      <div
        className="relative max-w-6xl mx-auto px-6 sm:px-12"
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex touch-pan-y gap-4 sm:gap-5">
            {SPEAKERS.map((speaker) => (
              <div
                key={speaker.name}
                className="group min-w-0 flex-[0_0_85%] sm:flex-[0_0_calc(50%-10px)]"
              >
                <Slide speaker={speaker} />
              </div>
            ))}
            <div
              key="archive-cta"
              className="group min-w-0 flex-[0_0_85%] sm:flex-[0_0_calc(50%-10px)]"
            >
              <ArchiveSlide />
            </div>
          </div>
        </div>
        <Arrow direction="prev" onClick={scrollPrev} />
        <Arrow direction="next" onClick={scrollNext} />
      </div>

      <div className="max-w-6xl mx-auto px-6 sm:px-12 py-8 flex items-center justify-center">
        <div className="flex gap-2">
          {Array.from({ length: snapCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === selected
                ? "w-8 bg-[#A80D0C]"
                : "w-4 bg-zinc-700 hover:bg-zinc-500"
                }`}
            />
          ))}
        </div>
      </div>

      <div className="sm:hidden max-w-6xl mx-auto px-6 pb-10">
        <Link
          href="/past-speakers"
          prefetch={false}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#A80D0C] hover:underline"
        >
          Explore The Archive
          <svg
            width="16"
            height="16"
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
        </Link>
      </div>
    </section>
  );
}
