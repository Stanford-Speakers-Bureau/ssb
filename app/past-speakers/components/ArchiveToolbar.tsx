"use client";

export default function ArchiveToolbar({
  query,
  onQueryChange,
  year,
  onYearChange,
  years,
  resultCount,
  totalCount,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  year: string | null;
  onYearChange: (y: string | null) => void;
  years: string[];
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-900 bg-white/85 dark:bg-black/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 sm:px-12 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="relative lg:w-72 shrink-0">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search speakers…"
              aria-label="Search speakers"
              className="w-full rounded-full border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-2 pl-10 pr-4 text-sm text-black dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#A80D0C] focus:border-transparent"
            />
          </div>

          {/* Year chips */}
          <div
            className="flex-1 min-w-0 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
            role="tablist"
            aria-label="Filter by year"
          >
            <Chip
              active={year === null}
              onClick={() => onYearChange(null)}
              label="All"
            />
            {years.map((y) => (
              <Chip
                key={y}
                active={year === y}
                onClick={() => onYearChange(y)}
                label={y}
              />
            ))}
          </div>

          {/* Count */}
          <div className="flex items-center shrink-0">
            <p className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              {resultCount === totalCount
                ? `${totalCount} speakers`
                : `${resultCount} of ${totalCount}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-sans transition-all ${
        active
          ? "bg-[#A80D0C] text-white border border-[#A80D0C]"
          : "border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-[#A80D0C] hover:text-[#A80D0C]"
      }`}
    >
      {label}
    </button>
  );
}

