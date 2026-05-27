"use client";

import type { ViewMode } from "./types";

export default function ArchiveToolbar({
  query,
  onQueryChange,
  year,
  onYearChange,
  viewMode,
  onViewModeChange,
  years,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  year: string | null;
  onYearChange: (y: string | null) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  years: string[];
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-zinc-900 bg-black/85 backdrop-blur-md">
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
              className="w-full rounded-full border border-zinc-800 bg-zinc-950 py-2 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#A80D0C] focus:border-transparent"
            />
          </div>

          {/* Year chips */}
          <div
            className="flex-1 min-w-0 flex gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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

          {/* View toggle */}
          <div className="flex items-center shrink-0">
            <div
              className="flex rounded-full border border-zinc-800 p-0.5"
              role="tablist"
              aria-label="View mode"
            >
              <ViewButton
                active={viewMode === "timeline"}
                onClick={() => onViewModeChange("timeline")}
                label="Timeline"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <circle cx="4" cy="6" r="1.5" />
                  <circle cx="4" cy="12" r="1.5" />
                  <circle cx="4" cy="18" r="1.5" />
                </svg>
              </ViewButton>
              <ViewButton
                active={viewMode === "expanded"}
                onClick={() => onViewModeChange("expanded")}
                label="Expanded"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="6" rx="1" />
                  <rect x="3" y="13" width="18" height="6" rx="1" />
                </svg>
              </ViewButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-label={`${label} view`}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-sans font-medium transition-all ${
        active ? "bg-[#A80D0C] text-white" : "text-zinc-400 hover:text-white"
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
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
          : "border border-zinc-800 text-zinc-300 hover:border-[#A80D0C] hover:text-[#A80D0C]"
      }`}
    >
      {label}
    </button>
  );
}
