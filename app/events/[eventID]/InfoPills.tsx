import { formatEventDate, formatTime } from "@/app/lib/supabase";

const pill =
  "inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] backdrop-blur-md border border-black/[0.1] dark:border-white/[0.1] px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm text-zinc-900/90 dark:text-white/90 font-medium";

type InfoPillsProps = {
  startTimeDate: string | null;
  doorsOpen: string | null;
  venue: string | null;
  venueLink: string | null;
};

function Pill({ children }: { children: React.ReactNode }) {
  return <span className={pill}>{children}</span>;
}

export default function InfoPills({
  startTimeDate,
  doorsOpen,
  venue,
  venueLink,
}: InfoPillsProps) {
  return (
    <div className="mt-3 sm:mt-6 flex flex-wrap gap-2 sm:gap-2.5">
      {startTimeDate && (
        <Pill>
          <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {formatEventDate(startTimeDate)}
        </Pill>
      )}
      {doorsOpen && (
        <Pill>
          <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 4h3a2 2 0 0 1 2 2v14" />
            <path d="M2 20h3" />
            <path d="M13 20h9" />
            <path d="M10 12v.01" />
            <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4.742-1.186A1 1 0 0 1 13 4.56z" />
          </svg>
          Doors open at {formatTime(doorsOpen)}
        </Pill>
      )}
      {startTimeDate && (
        <Pill>
          <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Doors close at {formatTime(startTimeDate)}
        </Pill>
      )}
      {venue && (
        venueLink ? (
          <a
            href={venueLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`${pill} transition-colors hover:bg-black/[0.1] dark:hover:bg-white/[0.14]`}
          >
            <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            {venue}
            <svg className="w-3 h-3 text-zinc-500 dark:text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </a>
        ) : (
          <Pill>
            <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            {venue}
          </Pill>
        )
      )}
    </div>
  );
}
