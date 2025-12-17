/**
 * Generate a referral code from a user's email address.
 * Takes the part before the "@" symbol.
 * Returns null if email is null or undefined.
 *
 * This is a pure utility function that can be used in both Client and Server Components.
 */
export function generateReferralCode(
  email: string | null | undefined,
): string | null {
  if (!email) return null;
  return email.split("@")[0] || null;
}

/**
 * Generate Google Calendar URL for an event
 */
export function generateGoogleCalendarUrl(event: {
  name: string | null;
  desc?: string | null;
  start_time_date: string | null;
  venue?: string | null;
  venue_link?: string | null;
  route?: string | null;
}): string {
  if (!event.start_time_date) return "";

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
  const eventUrl = event.route ? `${baseUrl}/events/${event.route}` : baseUrl;

  const startDate = new Date(event.start_time_date);
  const endDate = new Date(startDate.getTime() + 90 * 60 * 1000); // 90 minutes default

  // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
  const formatGoogleDate = (date: Date) => {
    return date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  };

  const title = encodeURIComponent(
    `Stanford Speakers Bureau: ${event.name || "Speaker Event"}`,
  );
  const details = encodeURIComponent(
    `${event.desc || "Stanford Speakers Bureau event"}\n\nView Event: ${eventUrl}`,
  );
  const location = encodeURIComponent(event.venue || "");
  const start = formatGoogleDate(startDate);
  const end = formatGoogleDate(endDate);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
}
