"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";
import { FEATURED_HOME_SPEAKERS } from "@/app/config/speakers";
import SpeakerDrawer from "@/app/past-speakers/components/SpeakerDrawer";
import type { FlatSpeaker } from "@/app/past-speakers/components/types";

type ShowcaseSpeaker = {
  slug: string;
  name: string;
  title: string;
  quote: string;
  image: string;
  drawerImage?: string;
  year: string;
  location?: string;
  bio: string;
  videoUrl?: string;
  videoLabel?: string;
  month?: string;
};

const AUTOPLAY_MS = 6000;

function ArchiveSlide() {
  return (
    <Link
      href="/past-speakers"
      prefetch={false}
      className="relative block h-[300px] w-full overflow-hidden rounded-[30px] border border-white/12 bg-gradient-to-br from-[#f0decd]/18 via-[#7f1613]/14 to-[#161211] shadow-[0_25px_80px_rgba(0,0,0,0.18)] transition-colors hover:border-[#e58c72]/60 focus:outline-none focus:ring-2 focus:ring-[#db4c3a] sm:h-[560px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#e56a53]/28 blur-3xl"
      />

      <div className="relative h-full flex flex-col justify-between p-6 sm:p-8">
        <div>
          <span className="mb-6 inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-sans uppercase tracking-[0.2em] text-white/78 backdrop-blur-md">
            Explore more
          </span>
          <h3 className="font-serif text-4xl sm:text-5xl text-white leading-[0.95] mb-4">
            90 years of <span className="text-[#f08f74]">voices</span>{" "}
            <span className="hidden sm:inline">on our stage</span>.
          </h3>
          <p className="max-w-sm font-sans text-sm leading-relaxed text-[#f2e3d6]/82 sm:text-base">
            From Nobel laureates to comedians, view every speaker who has graced
            an SSB stage.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 self-start rounded-full bg-[#fff8f1] px-6 py-3 text-sm font-semibold text-[#181210] shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-colors group-hover:bg-white">
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

function Slide({
  speaker,
  onOpen,
}: {
  speaker: ShowcaseSpeaker;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`More info about ${speaker.name}`}
      className="relative h-[300px] w-full overflow-hidden rounded-[30px] text-left shadow-[0_22px_70px_rgba(0,0,0,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#db4c3a] sm:h-[560px]"
    >
      <Image
        src={speaker.image}
        alt={`${speaker.name} speaking at Stanford University from Stanford Speakers Bureau (SSB)`}
        fill
        className="object-cover transition-transform duration-700 group-hover:scale-105"
        sizes="(max-width: 1023px) 85vw, (max-width: 1280px) 50vw, 33vw"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#120f0e]/92 via-[#120f0e]/48 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 px-6 pt-6 pb-3 sm:p-7">
        <span className="mb-3 inline-block rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[10px] font-sans uppercase tracking-[0.2em] text-white/78 backdrop-blur-md">
          {speaker.year} · {speaker.location ?? "Stanford"}
        </span>
        <h3 className="font-serif text-3xl sm:text-4xl text-white leading-[0.95] mb-2">
          {speaker.name}
        </h3>
        <p className="mb-3 font-sans text-sm italic text-[#f1ded1]/86">
          {speaker.title}
        </p>
        <p className="hidden font-sans text-sm leading-relaxed text-[#fff4ec]/88 line-clamp-3 sm:block">
          {speaker.quote}
        </p>
        <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-sans uppercase tracking-[0.2em] text-white/82 transition-colors group-hover:text-[#ffb8a7]">
          More info
          <svg
            width="12"
            height="12"
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
      aria-label={`${direction === "prev" ? "Previous" : "Next"} speaker`}
      className={`absolute top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#f4d8cd]/60 bg-[#fff8f1] text-[#181210] shadow-[0_18px_36px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-[52%] hover:bg-white lg:flex ${direction === "prev" ? "left-2" : "right-2"
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
      FEATURED_HOME_SPEAKERS.flatMap((s) => {
        const img = s.featuredImage ?? s.image;
        if (!img) return [];
        return [
          {
            slug: s.slug,
            name: s.name,
            title: s.title ?? "",
            quote: s.homeFeaturedQuote ?? s.bio,
            image: img,
            drawerImage: s.image,
            year: s.year,
            location: s.location,
            bio: s.bio,
            videoUrl: s.videoUrl,
            videoLabel: s.videoLabel,
            month: s.month,
          },
        ];
      }),
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
  const [drawerIndex, setDrawerIndex] = useState<number | null>(null);
  const drawerOpen = drawerIndex !== null;

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
      if (pausedRef.current || drawerOpen || document.hidden) return;
      emblaApi.scrollNext();
    }, AUTOPLAY_MS);
    return () => window.clearInterval(interval);
  }, [emblaApi, drawerOpen]);

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

  const openDrawer = useCallback((i: number) => {
    pausedRef.current = true;
    setDrawerIndex(i);
  }, []);
  const closeDrawer = useCallback(() => setDrawerIndex(null), []);
  const drawerPrev = useCallback(() => {
    setDrawerIndex((i) =>
      i === null ? null : (i - 1 + SPEAKERS.length) % SPEAKERS.length,
    );
  }, [SPEAKERS.length]);
  const drawerNext = useCallback(() => {
    setDrawerIndex((i) => (i === null ? null : (i + 1) % SPEAKERS.length));
  }, [SPEAKERS.length]);

  const drawerSpeaker: FlatSpeaker | null =
    drawerIndex === null
      ? null
      : {
        slug: SPEAKERS[drawerIndex].slug,
        name: SPEAKERS[drawerIndex].name,
        year: SPEAKERS[drawerIndex].year,
        title: SPEAKERS[drawerIndex].title || undefined,
        bio: SPEAKERS[drawerIndex].bio,
        videoUrl: SPEAKERS[drawerIndex].videoUrl,
        videoLabel: SPEAKERS[drawerIndex].videoLabel,
        month: SPEAKERS[drawerIndex].month,
        location: SPEAKERS[drawerIndex].location,
      };

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(219,76,58,0.12),transparent_32%),linear-gradient(180deg,#1a1412_0%,#211816_100%)] text-white">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      <div className="mx-auto max-w-[88rem] px-6 pb-8 pt-16 sm:px-12 sm:pt-20">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.3em] text-[#f19a80] sm:text-sm">
              Featured
            </p>
            <h2 className="font-serif text-3xl sm:text-5xl text-white">
              Who&rsquo;s Spoken at Stanford
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#e7d5c9]/78 sm:text-base">
              A few of the voices that have made an SSB stage feel
              unforgettable.
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link
              href="/past-speakers"
              prefetch={false}
              className="hidden items-center gap-2 rounded-full border border-white/16 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition-colors hover:bg-white/16 sm:inline-flex"
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
        className="relative max-w-[88rem] mx-auto px-6 sm:px-12"
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex touch-pan-y gap-4 lg:gap-5">
            {SPEAKERS.map((speaker, i) => (
              <div
                key={speaker.name}
                className="group min-w-0 flex-[0_0_85%] lg:flex-[0_0_calc(50%-10px)]"
              >
                <Slide speaker={speaker} onOpen={() => openDrawer(i)} />
              </div>
            ))}
            <div
              key="archive-cta"
              className="group min-w-0 flex-[0_0_85%] lg:flex-[0_0_calc(50%-10px)]"
            >
              <ArchiveSlide />
            </div>
          </div>
        </div>
        <Arrow direction="prev" onClick={scrollPrev} />
        <Arrow direction="next" onClick={scrollNext} />
      </div>

      <div className="mx-auto flex max-w-[88rem] items-center justify-center px-6 pb-4 pt-1 sm:px-12 sm:py-8">
        <div className="flex gap-2">
          {Array.from({ length: snapCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === selected
                ? "w-8 bg-[#f08f74]"
                : "w-4 bg-white/20 hover:bg-white/38"
                }`}
            />
          ))}
        </div>
      </div>

      <SpeakerDrawer
        speaker={drawerSpeaker}
        image={
          drawerIndex !== null
            ? (SPEAKERS[drawerIndex].drawerImage ?? SPEAKERS[drawerIndex].image)
            : undefined
        }
        onClose={closeDrawer}
        onPrev={drawerPrev}
        onNext={drawerNext}
        position={drawerIndex !== null ? drawerIndex + 1 : 0}
        total={SPEAKERS.length}
      />

      <div className="mx-auto max-w-[88rem] px-6 pb-10 sm:hidden">
        <Link
          href="/past-speakers"
          prefetch={false}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#ffb8a7] hover:underline"
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
