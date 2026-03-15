import Image from "next/image";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import InfoPills from "./InfoPills";

type HeroSectionProps = {
  name: string | null;
  tagline: string | null;
  signedImageUrl: string | null;
  startTimeDate: string | null;
  doorsOpen: string | null;
  venue: string | null;
  venueLink: string | null;
};

export default function HeroSection({
  name,
  tagline,
  signedImageUrl,
  startTimeDate,
  doorsOpen,
  venue,
  venueLink,
}: HeroSectionProps) {
  return (
    <section className="relative w-full overflow-hidden">
      {/* Speaker image – contained to hero only */}
      {signedImageUrl && (
        <div className="relative aspect-[3/2] sm:absolute sm:inset-0 sm:aspect-auto bg-zinc-200 dark:bg-zinc-800">
          <Image
            src={signedImageUrl}
            alt={name || "Event"}
            fill
            className="object-cover"
            priority
            quality={90}
            sizes="100vw"
            unoptimized
          />
          {/* Top fade for nav contrast */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, rgba(9,9,11,0.85) 0%, rgba(9,9,11,0.1) 25%, transparent 50%)",
            }}
          />
        </div>
      )}

      {/* Bottom fade into page background — light */}
      <div
        className="absolute inset-0 hidden sm:block dark:hidden"
        style={{
          background:
            "linear-gradient(to top, rgb(255,255,255) 0%, rgba(255,255,255,0.85) 30%, rgba(255,255,255,0.35) 60%, rgba(255,255,255,0.25) 100%)",
        }}
      />
      {/* Bottom fade into page background — dark */}
      <div
        className="absolute inset-0 hidden sm:dark:block"
        style={{
          background:
            "linear-gradient(to top, rgb(9,9,11) 0%, rgba(9,9,11,0.85) 30%, rgba(9,9,11,0.35) 60%, rgba(9,9,11,0.25) 100%)",
        }}
      />

      {/* Hero content – anchored bottom-left */}
      <div className="relative z-10 flex flex-col sm:justify-end sm:min-h-[78vh] lg:min-h-[85vh] max-w-6xl mx-auto w-full px-5 sm:px-8 lg:px-12 pt-5 sm:pt-28 pb-6 sm:pb-14">
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-zinc-900 dark:text-white font-serif tracking-tight leading-tight sm:leading-[1.1] dark:drop-shadow-lg">
          {name}
        </h1>
        {tagline && (
          <div className="mt-1.5 sm:mt-2.5 text-sm sm:text-lg lg:text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-6xl prose prose-sm sm:prose-lg prose-zinc dark:prose-invert prose-p:m-0 prose-a:text-red-500 dark:prose-a:text-red-400 prose-a:underline prose-a:underline-offset-2 max-w-none">
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{tagline}</ReactMarkdown>
          </div>
        )}

        <InfoPills
          startTimeDate={startTimeDate}
          doorsOpen={doorsOpen}
          venue={venue}
          venueLink={venueLink}
        />
      </div>
    </section>
  );
}
