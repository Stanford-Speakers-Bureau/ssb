import Link from "next/link";

type Props = {
  eventName: string | null;
  eventRoute: string;
};

export default function QuestionsHero({ eventName, eventRoute }: Props) {
  return (
    <section className="relative overflow-hidden bg-zinc-950 border-b border-zinc-900/70 pt-28 sm:pt-36 pb-12 sm:pb-20">
      <div className="absolute inset-0 bg-gradient-to-br from-[#A80D0C]/20 via-transparent to-transparent pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-6 sm:px-12">
        <Link
          href={`/events/${eventRoute}`}
          prefetch={false}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.3em] text-zinc-400 hover:text-white transition-colors mb-8"
        >
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
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to event
        </Link>

        <h1 className="font-serif text-5xl sm:text-7xl text-white leading-[1.05]">
          What questions should we ask{" "}
          <span className="text-[#A80D0C]">{eventName || "the speaker"}</span>?
        </h1>
      </div>
    </section>
  );
}
