import { createClient } from "@supabase/supabase-js";

export type Event = {
  id: string;
  created_at: string;
  name: string | null;
  desc: string | null;
  img: string | null;
  capacity: number;
  venue: string | null;
  reserved: number | null;
  venue_link: string | null;
  release_date: string | null;
  banner: boolean | null;
  start_time_date: string | null;
  doors_open: string | null;
};

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase configuration: please set SUPABASE_URL and SUPABASE_KEY."
    );
  }

  return createClient(url, key);
}

/**
 * Generate a signed URL for a speaker image from Supabase storage
 * @param imgName - The image filename from the img column
 * @param expiresIn - Expiration time in seconds (default 10)
 */
export async function getSignedImageUrl(
  imgName: string | null,
  expiresIn: number = 10
): Promise<string | null> {
  if (!imgName) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from("speakers")
    .createSignedUrl(imgName, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }

  return data?.signedUrl || null;
}

// Timezone for event display (Pacific Time for Stanford)
const EVENT_TIMEZONE = "America/Los_Angeles";

/**
 * Format a date for display (e.g., "January 23rd, 2026")
 */
export function formatEventDate(dateString: string | null): string {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  
  // Get day in the correct timezone
  const day = parseInt(date.toLocaleDateString("en-US", {
    day: "numeric",
    timeZone: EVENT_TIMEZONE,
  }));
  const suffix = getOrdinalSuffix(day);
  
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: EVENT_TIMEZONE,
  }).replace(/\d+/, `${day}${suffix}`);
}

/**
 * Format time for display (e.g., "7:30 PM")
 */
export function formatTime(dateString: string | null): string {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: EVENT_TIMEZONE,
  });
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/**
 * Generate an iCal (.ics) data URL for an event
 * Works with Google Calendar, Apple Calendar, Outlook, and all standard calendar apps
 */
export function generateICalUrl(event: {
  name: string | null;
  desc?: string | null;
  start_time_date: string | null;
  doors_open?: string | null;
  venue?: string | null;
}): string {
  if (!event.start_time_date) return "";

  const startDate = new Date(event.start_time_date);
  // Assume 1.5 hour event duration
  const endDate = new Date(startDate.getTime() + 90 * 60 * 1000);

  // Format dates for iCal (YYYYMMDDTHHmmssZ)
  const formatForICal = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };

  const title = `Stanford Speakers Bureau: ${event.name || "Speaker Event"}`;
  const description = event.desc || "Stanford Speakers Bureau event";
  const location = event.venue || "";
  const uid = `${formatForICal(startDate)}-ssb@stanfordspeakersbureau.org`;

  // Build iCal content
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stanford Speakers Bureau//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatForICal(new Date())}`,
    `DTSTART:${formatForICal(startDate)}`,
    `DTEND:${formatForICal(endDate)}`,
    `SUMMARY:${escapeICalText(title)}`,
    `DESCRIPTION:${escapeICalText(description)}`,
    `LOCATION:${escapeICalText(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  // Return as data URL
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
}

/**
 * Escape special characters for iCal format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

