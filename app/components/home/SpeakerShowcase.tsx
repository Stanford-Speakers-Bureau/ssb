"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";

type ShowcaseSpeaker = {
  name: string;
  title: string;
  quote: string;
  image: string;
  year: string;
};

const SPEAKERS: ShowcaseSpeaker[] = [
  {
    name: "Malala Yousafzai",
    title: "Nobel Peace Prize Laureate",
    quote:
      "Youngest Nobel Peace Prize laureate and global advocate for girls' education and women's rights.",
    image: "/speakers/malala-yousafzai.jpg",
    year: "2026",
  },
  {
    name: "Hasan Minhaj",
    title: "Comedian & Writer",
    quote:
      "Two-time Peabody Award-winning comedian, acclaimed for his Netflix specials and Patriot Act.",
    image: "/speakers/hasan-minhaj.jpg",
    year: "2026",
  },
  {
    name: "Mark Rober",
    title: "YouTube Educator & Engineer",
    quote:
      "Former NASA engineer turned YouTube star with 45M+ subscribers, making science accessible to millions.",
    image: "/speakers/mark-rober.jpeg",
    year: "2025",
  },
  {
    name: "JoJo Siwa",
    title: "Media Icon",
    quote:
      "Dancer, singer, and media icon with 41M+ TikTok followers who made history on Dancing with the Stars.",
    image: "/speakers/jojo-siwa.jpg",
    year: "2025",
  },
  {
    name: "John Green",
    title: "Author & YouTube Educator",
    quote:
      "Best-selling author of The Fault in Our Stars and co-creator of Crash Course with 15M+ subscribers.",
    image: "/speakers/john-green.jpg",
    year: "2024",
  },
];

const AUTOPLAY_MS = 6000;

function Slide({ speaker }: { speaker: ShowcaseSpeaker }) {
  return (
    <div className="relative h-[75vh] min-h-[500px] w-full overflow-hidden">
      <Image
        src={speaker.image}
        alt={`${speaker.name} speaking at Stanford University from Stanford Speakers Bureau (SSB)`}
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/30" />

      <div className="absolute inset-0 flex items-center">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 w-full">
          <div className="max-w-xl">
            <span className="inline-block mb-4 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-1.5 text-xs font-sans uppercase tracking-[0.2em] text-white/70">
              {speaker.year} · Stanford
            </span>
            <h3 className="font-serif text-5xl sm:text-7xl text-white leading-[0.9] mb-3">
              {speaker.name}
            </h3>
            <p className="font-sans text-base sm:text-lg italic text-zinc-300 mb-5">
              {speaker.title}
            </p>
            <p className="font-sans text-sm sm:text-base text-zinc-200 leading-relaxed max-w-md">
              {speaker.quote}
            </p>
          </div>
        </div>
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
      className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-20 h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white border border-white/20 shadow-lg transition-all hover:bg-[#A80D0C] hover:border-[#A80D0C] ${
        direction === "prev" ? "left-6" : "right-6"
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
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: true,
    slidesToScroll: 1,
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
        className="relative"
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {SPEAKERS.map((speaker) => (
              <div key={speaker.name} className="min-w-0 flex-[0_0_100%]">
                <Slide speaker={speaker} />
              </div>
            ))}
          </div>
        </div>
        <Arrow direction="prev" onClick={scrollPrev} />
        <Arrow direction="next" onClick={scrollNext} />
      </div>

      <div className="max-w-6xl mx-auto px-6 sm:px-12 py-8 flex items-center justify-between">
        <div className="flex gap-2">
          {SPEAKERS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Go to speaker ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === selected
                  ? "w-8 bg-[#A80D0C]"
                  : "w-4 bg-zinc-700 hover:bg-zinc-500"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          {selected + 1} / {SPEAKERS.length}
        </p>
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
