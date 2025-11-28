import { createClient } from "@supabase/supabase-js";

export type Event = {
  id: string;
  created_at: string;
  name: string | null;
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
 * Format a date for display (e.g., "January 23rd, 2026")
 */
export function formatEventDate(dateString: string | null): string {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  const day = date.getDate();
  const suffix = getOrdinalSuffix(day);
  
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
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

