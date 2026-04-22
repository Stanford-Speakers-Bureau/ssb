"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

const MotionLink = motion.create(Link);

type Program = {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  href: string;
  linkLabel: string;
  external?: boolean;
};

const PROGRAMS: Program[] = [
  {
    title: "Event Sponsorship",
    description:
      "We provide sponsorship for speaker fees and event costs, with our Community Uplift Fund prioritizing events centering traditionally marginalized communities.",
    image: "/meeting.JPG",
    imageAlt:
      "Students meeting to discuss who will speak at Stanford University from Stanford Speakers Bureau (SSB)",
    href: "/event-sponsorship",
    linkLabel: "View Sponsorship Programs",
  },
  {
    title: "Coffee Chats",
    description:
      "Intimate conversations with Stanford professors in small groups of eight to ten students. A unique opportunity to engage with faculty in a casual, personal setting.",
    image: "/coffee-chat.jpg",
    imageAlt:
      "Coffee Chats at Stanford University from Stanford Speakers Bureau (SSB)",
    href: "mailto:amock@stanford.edu",
    linkLabel: "Contact Andrea Mock",
    external: true,
  },
  {
    title: "Suggest a Speaker",
    description:
      "Know someone who would captivate the Stanford community? We want to hear your ideas for speakers.",
    image: "/speakers/mystery.jpg",
    imageAlt: "Suggest a speaker for Stanford Speakers Bureau (SSB)",
    href: "/suggest",
    linkLabel: "Submit a Suggestion",
  },
];

function ProgramCard({
  program,
  index,
}: {
  program: Program;
  index: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }}
      className={`group relative overflow-hidden rounded ${
        index === 0 ? "md:col-span-2 md:row-span-2 min-h-[420px]" : "min-h-[320px]"
      }`}
    >
      <Image
        src={program.image}
        alt={program.imageAlt}
        fill
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        sizes={
          index === 0
            ? "(max-width: 768px) 100vw, 66vw"
            : "(max-width: 768px) 100vw, 33vw"
        }
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/20 group-hover:from-black/95 group-hover:via-black/70 transition-all duration-500" />

      <div className="absolute inset-0 flex flex-col justify-end p-7 sm:p-9">
        <h3
          className={`font-serif text-white leading-tight mb-3 ${
            index === 0
              ? "text-3xl sm:text-4xl"
              : "text-2xl sm:text-3xl"
          }`}
        >
          {program.title}
        </h3>
        <p
          className={`font-sans text-zinc-200 leading-relaxed mb-5 ${
            index === 0
              ? "text-base max-w-lg"
              : "text-sm max-w-sm line-clamp-3"
          }`}
        >
          {program.description}
        </p>
        <MotionLink
          href={program.href}
          prefetch={false}
          target={program.external ? "_blank" : undefined}
          rel={program.external ? "noopener noreferrer" : undefined}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-2 w-fit rounded-full bg-[#A80D0C] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#C11211]"
        >
          {program.linkLabel}
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
        </MotionLink>
      </div>
    </motion.div>
  );
}

export default function ProgramsSection() {
  return (
    <section className="bg-zinc-50 dark:bg-zinc-950 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-6 sm:px-12">
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
            Beyond the Stage
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl text-black dark:text-white">
            Our Programs
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PROGRAMS.map((program, i) => (
            <ProgramCard key={program.title} program={program} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
