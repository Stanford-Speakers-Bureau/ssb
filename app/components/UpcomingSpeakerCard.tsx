"use client"

import Link from "next/link";

export type UpcomingSpeakerCardProps = {
  name?: string;
  header?: string;
  dateTimeText?: string;
  locationName?: string;
  locationUrl?: string;
  sponsorPrefix?: string; // e.g., "Sponsored by"
  sponsorName?: string;
  ctaText?: string;
  ctaHref?: string;
  backgroundImageUrl?: string; // e.g., "/events/speaker"
};

export default function UpcomingSpeakerCard({
  name = "",
  header = "",
  dateTimeText = "",
  locationName = "",
  locationUrl = "",
  sponsorPrefix = "",
  sponsorName = "",
  ctaText = "",
  ctaHref = "",
  backgroundImageUrl = "",
}: UpcomingSpeakerCardProps) {
  const showName = !!name;
  const showHeader = !!header;
  const showDate = !!dateTimeText;
  const showLocationName = !!locationName;
  const showLocationUrl = !!locationUrl;
  const showLocation = showLocationName || showLocationUrl;
  const showSponsorPrefix = !!sponsorPrefix;
  const showSponsorName = !!sponsorName;
  const showSponsor = showSponsorPrefix || showSponsorName;
  const showCta = !!ctaText && !!ctaHref;
  const showMeta = showDate || showLocation || showSponsor;

  return (
    <div
      className="relative rounded-lg p-8 shadow-sm overflow-hidden"
      style={{
        ...(backgroundImageUrl ? { backgroundImage: `url(${backgroundImageUrl})` } : {}),
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Semi-transparent overlay for better text readability */}
      <div className="absolute inset-0 bg-black/70 z-0"></div>

      <div className="relative z-10">
        {showName && (
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white mb-2">{name}</h2>
        )}
        {showHeader && (
          <p className="text-base sm:text-lg text-zinc-200 mb-6 italic">{header}</p>
        )}

        {showMeta && (
          <div className="space-y-3 mb-6">
            {showDate && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-red-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-base text-white font-medium">{dateTimeText}</p>
              </div>
            )}

            {showLocation && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-red-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {showLocationName && showLocationUrl ? (
                  <a
                    href={locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base text-white font-medium underline decoration-zinc-300 decoration-1 underline-offset-2 transition-all hover:scale-105 active:scale-95 inline-block"
                  >
                    {locationName}
                  </a>
                ) : showLocationName ? (
                  <span className="text-base text-white font-medium">{locationName}</span>
                ) : null}
              </div>
            )}

            {showSponsor && (
              <div className="flex items-center gap-2">
                <p className="text-base text-white">
                  {showSponsorPrefix && <span>{sponsorPrefix}{showSponsorName ? " " : ""}</span>}
                  {showSponsorName && <span className="font-semibold">{sponsorName}</span>}
                </p>
              </div>
            )}
          </div>
        )}

        {showCta && (
          <Link
            href={ctaHref}
            target=""
            rel=""
            className="inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-semibold text-white bg-[#A80D0C] shadow-md transition-all hover:bg-[#8B0A0A] hover:shadow-lg hover:scale-105 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {ctaText}
          </Link>
        )}
      </div>
    </div>
  );
}