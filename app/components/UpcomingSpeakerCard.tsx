"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NOTIFY_MESSAGES } from "../lib/constants";
import Image from "next/image";

export type UpcomingSpeakerCardProps = {
  name?: string;
  header?: string;
  dateText?: string; // e.g., "January 23rd, 2026"
  doorsOpenText?: string; // e.g., "Doors open at 7:30 PM"
  eventTimeText?: string; // e.g., "Event starts at 8:00 PM"
  locationName?: string;
  locationUrl?: string;
  sponsorPrefix?: string; // e.g., "Sponsored by"
  sponsorName?: string;
  ctaText?: string;
  ctaHref?: string;
  backgroundImageUrl?: string; // e.g., "/events/speaker"
  mystery?: boolean; // Adds blur effect to hide identity
  calendarUrl?: string; // iCal URL for adding event
  eventId?: string; // Event ID for notify signup
  isAlreadyNotified?: boolean; // Whether user is signed up for notifications
  capacity?: number | null; // Event capacity
  ticketsSold?: number | null; // Number of tickets sold
  reserved?: number | null; // Reserved seats
};

export default function UpcomingSpeakerCard({
  name = "",
  header = "",
  dateText = "",
  doorsOpenText = "",
  eventTimeText = "",
  locationName = "",
  locationUrl = "",
  sponsorPrefix = "",
  sponsorName = "",
  ctaText = "",
  ctaHref = "",
  backgroundImageUrl = "",
  mystery = false,
  calendarUrl = "",
  eventId = "",
  isAlreadyNotified = false,
  capacity = null,
  ticketsSold = null,
  reserved = null,
}: UpcomingSpeakerCardProps) {
  const showName = !!name;
  const showHeader = !!header;
  const showDate = !!dateText;
  const showDoorsOpen = !!doorsOpenText;
  const showEventTime = !!eventTimeText;
  const showLocationName = !!locationName;
  const showLocationUrl = !!locationUrl;
  const showLocation = showLocationName || showLocationUrl;
  const showSponsorPrefix = !!sponsorPrefix;
  const showSponsorName = !!sponsorName;
  const showSponsor = showSponsorPrefix || showSponsorName;
  const showCta = !!ctaText && !!ctaHref;
  const showTicketInfo = !mystery && capacity !== null && capacity > 0;
  const showMeta =
    showDate ||
    showDoorsOpen ||
    showEventTime ||
    showLocation ||
    showSponsor ||
    showTicketInfo;
  const showCalendarLink = !mystery && !!calendarUrl;
  const showNotifyButton = mystery && !!eventId;

  // Calculate tickets left
  const maxTickets = showTicketInfo
    ? Math.max(0, capacity - (reserved || 0))
    : 0;
  const ticketsLeft = showTicketInfo
    ? Math.max(0, maxTickets - (ticketsSold || 0))
    : 0;

  const [notifyStatus, setNotifyStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >(isAlreadyNotified ? "success" : "idle");
  const [notifyMessage, setNotifyMessage] = useState(
    isAlreadyNotified ? NOTIFY_MESSAGES.ALREADY_SIGNED_UP : "",
  );
  const [imageLoaded, setImageLoaded] = useState(!backgroundImageUrl);

  // If the background URL changes, treat it as "not loaded yet" until the new image finishes.
  useEffect(() => {
    setImageLoaded(!backgroundImageUrl);
  }, [backgroundImageUrl]);

  // Sync state with prop when it changes (e.g., after redirect and page refresh)
  useEffect(() => {
    if (isAlreadyNotified && notifyStatus !== "success") {
      // Defer state update to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setNotifyStatus("success");
        setNotifyMessage(NOTIFY_MESSAGES.SUCCESS);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isAlreadyNotified, notifyStatus]);

  const handleNotifyClick = async () => {
    setNotifyStatus("loading");

    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_id: eventId }),
      });

      if (response.status === 401) {
        // Not authenticated, redirect to Google sign-in
        window.location.href = `/api/auth/google?redirect_to=${encodeURIComponent(`/upcoming-speakers?notify=${eventId}`)}`;
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setNotifyStatus("success");
        setNotifyMessage(NOTIFY_MESSAGES.SUCCESS);
      } else if (response.status === 409) {
        setNotifyStatus("success");
        setNotifyMessage(NOTIFY_MESSAGES.ALREADY_SIGNED_UP);
      } else {
        setNotifyStatus("error");
        setNotifyMessage(data.error || "Something went wrong");
      }
    } catch {
      setNotifyStatus("error");
      setNotifyMessage(NOTIFY_MESSAGES.ERROR_GENERIC);
    }
  };

  if (!imageLoaded && backgroundImageUrl) {
    return (
      <div className="relative rounded p-8 shadow-sm overflow-hidden bg-zinc-900">
        {/* Hidden optimized Image to trigger load completion */}
        <div className="absolute inset-0 z-0">
          <div className="relative w-full h-full">
            <Image
              src={backgroundImageUrl}
              alt=""
              fill
              className="object-cover opacity-0"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
              quality={90}
            />
          </div>
        </div>
        <div className="flex flex-col h-full">
          {/* Title / Name */}
          <div className="h-8 md:h-9 bg-zinc-800 rounded-md w-3/4 mb-2 animate-pulse"></div>

          {/* Subtitle / Header */}
          <div className="h-5 md:h-6 bg-zinc-800 rounded-md w-1/2 mb-6 animate-pulse"></div>

          {/* Meta Information Section */}
          <div className="space-y-3 mb-6 flex-1">
            {/* Date */}
            <div className="flex items-center gap-2 animate-pulse">
              <div className="w-5 h-5 bg-zinc-800 rounded shrink-0"></div>
              <div className="h-4 bg-zinc-800 rounded w-48"></div>
            </div>
            {/* Doors Open */}
            <div className="flex items-center gap-2 animate-pulse">
              <div className="w-5 h-5 bg-zinc-800 rounded shrink-0"></div>
              <div className="h-4 bg-zinc-800 rounded w-40"></div>
            </div>
            {/* Event Time */}
            <div className="flex items-center gap-2 animate-pulse">
              <div className="w-5 h-5 bg-zinc-800 rounded shrink-0"></div>
              <div className="h-4 bg-zinc-800 rounded w-36"></div>
            </div>
            {/* Location */}
            <div className="flex items-center gap-2 animate-pulse">
              <div className="w-5 h-5 bg-zinc-800 rounded shrink-0"></div>
              <div className="h-4 bg-zinc-800 rounded w-56"></div>
            </div>
          </div>

          {/* Button Placeholder */}
          <div className="h-10 w-32 bg-zinc-800 rounded-md mt-auto animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate rounded p-8 shadow-sm overflow-hidden">
      {/* Background Image */}
      {backgroundImageUrl && (
        <div className="absolute inset-0 z-0">
          <div className="relative w-full h-full">
            <Image
              src={backgroundImageUrl}
              alt={name || "Speaker"}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={false}
              quality={90}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
          </div>
        </div>
      )}

      {/* Semi-transparent overlay for better text readability */}
      <div
        className={`absolute inset-0 z-10 ${mystery ? "backdrop-blur-xl bg-black/50" : "bg-black/70"}`}
      ></div>

      <div className="relative z-20">
        {showName && (
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white mb-2">
            {name}
          </h2>
        )}
        {showHeader && (
          <p className="text-base sm:text-lg text-zinc-200 mb-6 italic">
            {header}
          </p>
        )}

        {showMeta && (
          <div className="space-y-3 mb-6">
            {showDate && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-red-500 shrink-0"
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
                {showCalendarLink ? (
                  <a
                    href={calendarUrl}
                    download="event.ics"
                    className="text-base text-white font-medium underline decoration-zinc-300 decoration-1 underline-offset-2 transition-all hover:scale-105 active:scale-95 inline-block"
                  >
                    {dateText}
                  </a>
                ) : (
                  <p className="text-base text-white font-medium">{dateText}</p>
                )}
              </div>
            )}

            {showDoorsOpen && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-red-500 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 4h3a2 2 0 0 1 2 2v14" />
                  <path d="M2 20h3" />
                  <path d="M13 20h9" />
                  <path d="M10 12v.01" />
                  <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4.742-1.186A1 1 0 0 1 13 4.56z" />
                </svg>
                <p className="text-base text-white font-medium">
                  {doorsOpenText}
                </p>
              </div>
            )}

            {showEventTime && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-red-500 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-base text-white font-medium">
                  {eventTimeText}
                </p>
              </div>
            )}

            {showLocation && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-red-500 shrink-0"
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
                  <span className="text-base text-white font-medium">
                    {locationName}
                  </span>
                ) : null}
              </div>
            )}

            {showSponsor && (
              <div className="flex items-center gap-2">
                <p className="text-base text-white">
                  {showSponsorPrefix && (
                    <span>
                      {sponsorPrefix}
                      {showSponsorName ? " " : ""}
                    </span>
                  )}
                  {showSponsorName && (
                    <span className="font-semibold">{sponsorName}</span>
                  )}
                </p>
              </div>
            )}

            {showTicketInfo && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-red-500 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-base text-white font-medium">
                  Tickets left: {ticketsLeft} / {maxTickets}
                </p>
              </div>
            )}
          </div>
        )}

        {showCta && (
          <Link
            href={ctaHref}
            prefetch={false}
            target=""
            rel=""
            className="inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-semibold text-white bg-[#A80D0C] shadow-md transition-all hover:bg-[#C11211] hover:shadow-lg hover:scale-105 active:scale-95"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
            {ctaText}
          </Link>
        )}

        {showNotifyButton &&
          (notifyStatus === "success" ? (
            <p className="text-sm text-green-400 font-medium">
              {notifyMessage}
            </p>
          ) : notifyStatus === "error" ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-400">{notifyMessage}</p>
              <button
                onClick={handleNotifyClick}
                className="text-sm text-white underline hover:text-zinc-300"
              >
                Try again
              </button>
            </div>
          ) : (
            <button
              onClick={handleNotifyClick}
              disabled={notifyStatus === "loading"}
              className="inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-semibold text-white bg-[#A80D0C] shadow-md transition-all hover:bg-[#C11211] hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {notifyStatus === "loading" ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              )}
              {notifyStatus === "loading" ? "Signing up..." : "Notify Me"}
            </button>
          ))}
      </div>
    </div>
  );
}
