"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";

const AUTOPLAY_INTERVAL_MS = 4500;

type Speaker = {
  name: string;
  title: string;
  description: string;
  image: string;
};

const speakers: Speaker[] = [
  {
    name: "Malala Yousafzai",
    title: "Nobel Peace Prize Laureate",
    description:
      "Youngest Nobel Peace Prize laureate and global advocate for girls' education and women's rights.",
    image: "/speakers/malala-yousafzai.jpg",
  },
  {
    name: "Bernie Sanders",
    title: "U.S. Senator from Vermont",
    description:
      "Longest-serving independent in congressional history and one of the most prominent progressive voices in American politics.",
    image: "/speakers/bernie.jpg",
  },
  {
    name: "Hasan Minhaj",
    title: 'Comedian & Former "Patriot Act" Host',
    description:
      'Two-time Peabody Award-winning comedian, acclaimed for his Netflix specials and as creator and host of "Patriot Act with Hasan Minhaj."',
    image: "/speakers/hasan-minhaj.jpg",
  },
  {
    name: "JoJo Siwa",
    title: "Media Icon",
    description:
      "Media icon, dancer, and singer who rose to fame through the reality show Dance Moms and her vibrant online presence.",
    image: "/speakers/jojo-siwa.jpg",
  },
  {
    name: "Mark Rober",
    title: "YouTube Educator, Former NASA & Apple Engineer",
    description:
      "Former NASA engineer turned YouTube star with 45+ million subscribers, known for viral science and engineering videos.",
    image: "/speakers/mark-rober.jpeg",
  },
];

function SpeakerCard({ speaker }: { speaker: Speaker }) {
  return (
    <div className="relative p-6 rounded overflow-hidden min-h-[400px] h-full flex flex-col justify-end">
      <Image
        src={speaker.image}
        alt={`${speaker.name} speaking at Stanford University from Stanford Speakers Bureau (SSB)`}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 85vw, (max-width: 1024px) 45vw, 31vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
      <div className="relative z-10">
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 font-serif">
          {speaker.name}
        </h3>
        <p className="text-sm sm:text-base text-gray-200 mb-3 italic">
          {speaker.title}
        </p>
        <p className="text-sm sm:text-base text-gray-100 leading-relaxed">
          {speaker.description}
        </p>
      </div>
    </div>
  );
}

function ViewMoreCard() {
  return (
    <Link
      href="/past-speakers"
      prefetch={false}
      className="relative p-6 rounded overflow-hidden min-h-[400px] h-full flex flex-col justify-center items-center group"
    >
      <Image
        src="/speakers/john-green.jpg"
        alt="John Green speaking at Stanford University from Stanford Speakers Bureau (SSB)"
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 768px) 85vw, (max-width: 1024px) 45vw, 31vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 to-black/50" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 font-serif">
          View More Past Speakers
        </h3>
        <p className="text-sm sm:text-base text-gray-200 italic mb-4">
          Explore our full history of speakers
        </p>
        <span className="inline-flex items-center gap-2 text-white font-semibold border-2 border-white rounded px-5 py-2 transition-colors group-hover:bg-white/10">
          Browse All
          <svg
            xmlns="http://www.w3.org/2000/svg"
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
    </Link>
  );
}

function ArrowButton({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous speakers" : "Next speakers"}
      className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-20 h-12 w-12 items-center justify-center rounded-full bg-[#A80D0C] text-white shadow-lg transition-all hover:bg-[#C11211] disabled:opacity-30 disabled:cursor-not-allowed ${direction === "prev" ? "left-2 lg:-left-5" : "right-2 lg:-right-5"
        }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
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

export default function FeaturedSpeakersCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: true,
    slidesToScroll: 1,
    containScroll: "trimSnaps",
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const pausedRef = useRef(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const stopAutoplay = () => {
      pausedRef.current = true;
    };
    emblaApi.on("pointerDown", stopAutoplay);

    const interval = window.setInterval(() => {
      if (pausedRef.current) return;
      if (!emblaApi) return;
      if (document.hidden) return;
      emblaApi.scrollNext();
    }, AUTOPLAY_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      emblaApi.off("pointerDown", stopAutoplay);
    };
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    pausedRef.current = true;
    emblaApi?.scrollPrev();
  }, [emblaApi]);
  const scrollNext = useCallback(() => {
    pausedRef.current = true;
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const handleMouseEnter = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const handleMouseLeave = useCallback(() => {
    pausedRef.current = false;
  }, []);

  return (
    <div
      className="relative mb-16"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-6 touch-pan-y">
          {speakers.map((speaker) => (
            <div
              key={speaker.name}
              className="flex-[0_0_85%] sm:flex-[0_0_60%] md:flex-[0_0_45%] lg:flex-[0_0_32%] min-w-0"
            >
              <SpeakerCard speaker={speaker} />
            </div>
          ))}
          <div className="flex-[0_0_85%] sm:flex-[0_0_60%] md:flex-[0_0_45%] lg:flex-[0_0_32%] min-w-0">
            <ViewMoreCard />
          </div>
        </div>
      </div>
      <ArrowButton direction="prev" onClick={scrollPrev} disabled={!canPrev} />
      <ArrowButton direction="next" onClick={scrollNext} disabled={!canNext} />
    </div>
  );
}
