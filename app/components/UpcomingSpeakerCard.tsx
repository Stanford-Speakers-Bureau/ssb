"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NOTIFY_MESSAGES } from "@/app/lib/constants";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { sanitizeSchema } from "@/app/lib/sanitize";
import CountdownTimer from "@/app/events/[eventID]/CountdownTimer";

export type UpcomingSpeakerCardProps = {
  name?: string;
  header?: string;
  dateText?: string; // e.g., "January 23rd, 2026"
  doorsOpenText?: string; // e.g., "Doors open at 7:30 PM"
  eventTimeText?: string; // e.g., "Starts at 8:00 PM"
  locationName?: string;
  locationUrl?: string;
  sponsorPrefix?: string; // e.g., "Sponsored by"
  sponsorName?: string;
  ctaText?: string;
  ctaHref?: string;
  backgroundImageUrl?: string; // e.g., "/events/speaker"
  mystery?: boolean; // Adds blur effect to hide identity
  googleCalendarUrl?: string; // Google Calendar URL
  appleCalendarUrl?: string; // Apple Calendar URL (ICS data URL)
  eventId?: string; // Event ID for notify signup
  isAlreadyNotified?: boolean; // Whether user is signed up for notifications
  isLoggedIn?: boolean; // Whether the current viewer is signed in
  eventDateRaw?: string | null; // Raw ISO date for countdown timer
  capacity?: number | null; // Event capacity
  ticketsSold?: number | null; // Number of tickets sold
  reserved?: number | null; // Reserved seats
};

const PILL_CLASS =
  "inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.1] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-white/90 font-medium";

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
  eventId = "",
  isAlreadyNotified = false,
  isLoggedIn = false,
  eventDateRaw = null,
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
  const showCta = !mystery && !!ctaText && !!ctaHref;
  const showTicketInfo = !mystery && capacity !== null && capacity > 0;
  const showMeta =
    showDate ||
    showDoorsOpen ||
    showEventTime ||
    showLocation ||
    showSponsor ||
    showTicketInfo;
  const showNotifyButton = mystery && !!eventId;

  // Calculate tickets left
  const maxTickets = showTicketInfo
    ? Math.max(0, capacity - (reserved || 0))
    : 0;
  const ticketsLeft = showTicketInfo
    ? Math.max(0, maxTickets - (ticketsSold || 0))
    : 0;

  // Suppress unused variable warnings for kept props
  void maxTickets;
  void ticketsLeft;
  void showTicketInfo;

  const [notifyStatus, setNotifyStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >(isAlreadyNotified ? "success" : "idle");
  const [notifyMessage, setNotifyMessage] = useState(
    isAlreadyNotified ? NOTIFY_MESSAGES.ALREADY_SIGNED_UP : "",
  );

  // Sync state with prop when it changes (e.g., after redirect and page refresh)
  useEffect(() => {
    if (isAlreadyNotified && notifyStatus !== "success") {
      const timeoutId = setTimeout(() => {
        setNotifyStatus("success");
        setNotifyMessage(NOTIFY_MESSAGES.SUCCESS);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isAlreadyNotified, notifyStatus]);

  const handleNotifyClick = async () => {
    if (!isLoggedIn) {
      window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(`/upcoming-speakers?notify=${eventId}`)}`;
      return;
    }

    setNotifyStatus("loading");

    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_id: eventId }),
      });

      if (response.status === 401) {
        window.location.href = `/api/auth/login?redirect_to=${encodeURIComponent(`/upcoming-speakers?notify=${eventId}`)}`;
        return;
      }

      const data = (await response.json()) as {
        alreadySignedUp?: boolean;
        error?: string;
      };

      if (response.ok) {
        setNotifyStatus("success");
        setNotifyMessage(
          data.alreadySignedUp
            ? NOTIFY_MESSAGES.ALREADY_SIGNED_UP
            : NOTIFY_MESSAGES.SUCCESS,
        );
      } else {
        setNotifyStatus("error");
        setNotifyMessage(data.error || "Something went wrong");
      }
    } catch {
      setNotifyStatus("error");
      setNotifyMessage(NOTIFY_MESSAGES.ERROR_GENERIC);
    }
  };

  if (mystery) {
    return <MysteryCard
      showDate={showDate}
      dateText={dateText}
      showDoorsOpen={showDoorsOpen}
      doorsOpenText={doorsOpenText}
      showEventTime={showEventTime}
      eventTimeText={eventTimeText}
      showLocation={showLocation}
      showLocationName={showLocationName}
      showLocationUrl={showLocationUrl}
      locationName={locationName}
      locationUrl={locationUrl}
      showNotifyButton={showNotifyButton}
      notifyStatus={notifyStatus}
      notifyMessage={notifyMessage}
      handleNotifyClick={handleNotifyClick}
      eventDateRaw={eventDateRaw}
    />;
  }

  return <RevealedCard
    backgroundImageUrl={backgroundImageUrl}
    name={name}
    showName={showName}
    showHeader={showHeader}
    header={header}
    showMeta={showMeta}
    showDate={showDate}
    dateText={dateText}
    showDoorsOpen={showDoorsOpen}
    doorsOpenText={doorsOpenText}
    showEventTime={showEventTime}
    eventTimeText={eventTimeText}
    showLocation={showLocation}
    showLocationName={showLocationName}
    showLocationUrl={showLocationUrl}
    locationName={locationName}
    locationUrl={locationUrl}
    showSponsor={showSponsor}
    showSponsorPrefix={showSponsorPrefix}
    sponsorPrefix={sponsorPrefix}
    showSponsorName={showSponsorName}
    sponsorName={sponsorName}
    showCta={showCta}
    ctaHref={ctaHref}
    ctaText={ctaText}
  />;
}

// --- Icons (matching event page pill style) ---

function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function DoorIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 4h3a2 2 0 0 1 2 2v14" />
      <path d="M2 20h3" />
      <path d="M13 20h9" />
      <path d="M10 12v.01" />
      <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4.742-1.186A1 1 0 0 1 13 4.56z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3 h-3 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
  );
}

// --- Revealed Speaker Card ---

function RevealedCard({
  backgroundImageUrl,
  name,
  showName,
  showHeader,
  header,
  showMeta,
  showDate,
  dateText,
  showDoorsOpen,
  doorsOpenText,
  showEventTime,
  eventTimeText,
  showLocation,
  showLocationName,
  showLocationUrl,
  locationName,
  locationUrl,
  showSponsor,
  showSponsorPrefix,
  sponsorPrefix,
  showSponsorName,
  sponsorName,
  showCta,
  ctaHref,
  ctaText,
}: {
  backgroundImageUrl: string;
  name: string;
  showName: boolean;
  showHeader: boolean;
  header: string;
  showMeta: boolean;
  showDate: boolean;
  dateText: string;
  showDoorsOpen: boolean;
  doorsOpenText: string;
  showEventTime: boolean;
  eventTimeText: string;
  showLocation: boolean;
  showLocationName: boolean;
  showLocationUrl: boolean;
  locationName: string;
  locationUrl: string;
  showSponsor: boolean;
  showSponsorPrefix: boolean;
  sponsorPrefix: string;
  showSponsorName: boolean;
  sponsorName: string;
  showCta: boolean;
  ctaHref: string;
  ctaText: string;
}) {
  // Shared pill elements rendered once, displayed in different containers per breakpoint
  const metaPills = showMeta ? (
    <>
      {showDate && (
        <span className={PILL_CLASS}>
          <CalendarIcon />
          {dateText}
        </span>
      )}
      {showDoorsOpen && (
        <span className={PILL_CLASS}>
          <DoorIcon />
          {doorsOpenText}
        </span>
      )}
      {showEventTime && (
        <span className="hidden md:contents">
          <span className={PILL_CLASS}>
            <ClockIcon />
            {eventTimeText}
          </span>
        </span>
      )}
      {showLocation &&
        (showLocationName && showLocationUrl ? (
          <a
            href={locationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${PILL_CLASS} transition-colors hover:bg-white/[0.14]`}
          >
            <LocationIcon />
            {locationName}
            <ExternalLinkIcon />
          </a>
        ) : showLocationName ? (
          <span className={PILL_CLASS}>
            <LocationIcon />
            {locationName}
          </span>
        ) : null)}
      {showSponsor && (
        <span className={PILL_CLASS}>
          {showSponsorPrefix && sponsorPrefix}
          {showSponsorPrefix && showSponsorName && " "}
          {showSponsorName && <span className="font-semibold">{sponsorName}</span>}
        </span>
      )}
    </>
  ) : null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Image */}
      <div className="relative w-full aspect-[2/1] overflow-hidden bg-zinc-800">
        {backgroundImageUrl && (
          <Image
            src={backgroundImageUrl}
            alt={name || "Speaker"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 960px"
            priority
            unoptimized
          />
        )}

        {/* Gradient + overlay content — lg and above only */}
        <div
          className="absolute inset-0 hidden lg:block"
          style={{
            background:
              "linear-gradient(to top, rgb(24,24,27) 0%, rgba(24,24,27,0.8) 20%, rgba(24,24,27,0.2) 45%, transparent 65%)",
          }}
        />
        <div className="absolute inset-0 z-10 hidden lg:flex flex-col justify-end px-10 pb-6">
          {showName && (
            <h2 className="text-5xl font-bold font-serif text-white tracking-tight leading-[1.1] drop-shadow-lg">
              {name}
            </h2>
          )}
          {showHeader && (
            <div className="mt-2 text-lg text-zinc-300 italic leading-relaxed prose prose-lg prose-invert prose-p:m-0 prose-a:text-red-400 prose-a:underline prose-a:underline-offset-2 max-w-none">
              <ReactMarkdown rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}>{header}</ReactMarkdown>
            </div>
          )}
          {metaPills && (
            <div className="mt-5 flex flex-wrap gap-2.5">
              {metaPills}
            </div>
          )}
        </div>
      </div>

      {/* Below-image content — below lg */}
      <div className="lg:hidden px-5 sm:px-6 pt-4 pb-2">
        {showName && (
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight leading-tight">
            {name}
          </h2>
        )}
        {showHeader && (
          <div className="mt-1.5 text-sm sm:text-base text-zinc-400 italic leading-relaxed prose prose-sm sm:prose-base prose-invert prose-p:m-0 prose-a:text-red-400 prose-a:underline prose-a:underline-offset-2 max-w-none">
            <ReactMarkdown rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}>{header}</ReactMarkdown>
          </div>
        )}
        {metaPills && (
          <div className="mt-3 flex flex-wrap gap-2">
            {metaPills}
          </div>
        )}
      </div>

      {/* Full-width CTA button */}
      {showCta && (
        <div className="px-5 sm:px-6 pb-4 sm:pb-5">
          <Link
            href={ctaHref}
            prefetch={false}
            className="flex items-center justify-center gap-2 rounded-lg w-full px-6 py-3.5 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] shadow-md transition-all hover:bg-[#C11211] hover:shadow-lg hover:shadow-red-900/20 active:scale-[0.98]"
          >
            {ctaText}
          </Link>
        </div>
      )}
    </div>
  );
}

// --- Mystery Speaker Card ---

function MysteryCard({
  showDate,
  dateText,
  showDoorsOpen,
  doorsOpenText,
  showEventTime,
  eventTimeText,
  showLocation,
  showLocationName,
  showLocationUrl,
  locationName,
  locationUrl,
  showNotifyButton,
  notifyStatus,
  notifyMessage,
  handleNotifyClick,
  eventDateRaw,
}: {
  showDate: boolean;
  dateText: string;
  showDoorsOpen: boolean;
  doorsOpenText: string;
  showEventTime: boolean;
  eventTimeText: string;
  showLocation: boolean;
  showLocationName: boolean;
  showLocationUrl: boolean;
  locationName: string;
  locationUrl: string;
  showNotifyButton: boolean;
  notifyStatus: "idle" | "loading" | "success" | "error";
  notifyMessage: string;
  handleNotifyClick: () => void;
  eventDateRaw: string | null;
}) {
  const countdownDate = eventDateRaw ? new Date(eventDateRaw) : null;
  const showCountdown =
    countdownDate && !Number.isNaN(countdownDate.getTime()) && countdownDate > new Date();
  return (
    <div className="relative rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden text-center">
      {/* Blurred mystery background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/speakers/mystery.jpg"
          alt=""
          fill
          className="object-cover blur-xl scale-110"
          sizes="(max-width: 768px) 100vw, 960px"
          unoptimized
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 p-10 sm:p-12">
        {/* Large question mark */}
        <div className="text-8xl sm:text-9xl font-serif font-bold text-red-500/80 mb-4 select-none">
          ?
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold text-zinc-300 mb-6">
          Speaker — To Be Announced
        </h2>

        {showCountdown && countdownDate && (
          <div className="mb-6">
            <CountdownTimer targetDate={countdownDate} />
          </div>
        )}

        {/* Compact metadata pills */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
          {showDate && (
            <span className={PILL_CLASS}>
              <CalendarIcon />
              {dateText}
            </span>
          )}
          {showDoorsOpen && (
            <span className={PILL_CLASS}>
              <DoorIcon />
              {doorsOpenText}
            </span>
          )}
          {showEventTime && (
            <span className={PILL_CLASS}>
              <ClockIcon />
              {eventTimeText}
            </span>
          )}
          {showLocation && (
            showLocationName && showLocationUrl ? (
              <a
                href={locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${PILL_CLASS} transition-colors hover:bg-white/[0.14]`}
              >
                <LocationIcon />
                {locationName}
                <ExternalLinkIcon />
              </a>
            ) : showLocationName ? (
              <span className={PILL_CLASS}>
                <LocationIcon />
                {locationName}
              </span>
            ) : null
          )}
        </div>

        {/* Notify button */}
        {showNotifyButton && (
          <div>
            {notifyStatus === "success" ? (
              <p className="text-sm text-green-400 font-medium">
                {notifyMessage}
              </p>
            ) : notifyStatus === "error" ? (
              <div className="flex items-center justify-center gap-3">
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
                className="inline-flex items-center gap-2 rounded px-6 py-3 text-sm font-semibold text-white bg-[#A80D0C] shadow-md transition-all hover:bg-[#C11211] hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {notifyStatus === "loading" ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                )}
                {notifyStatus === "loading" ? "Signing up..." : "Notify Me"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
