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
 * Supports both event display and ticket email use cases
 */
export function generateGoogleCalendarUrl(event: {
  name?: string | null;
  desc?: string | null;
  start_time_date?: string | null;
  venue?: string | null;
  venue_link?: string | null;
  route?: string | null;
  // Ticket email fields (alternative to event fields)
  eventName?: string | null;
  eventStartTime?: string | null;
  eventRoute?: string | null;
  eventVenue?: string | null;
  eventDescription?: string | null;
  ticketId?: string;
  ticketEmail?: string;
  ticketType?: string;
}): string {
  // Support both event.start_time_date (for event pages) and eventStartTime (for ticket emails)
  const startTime = event.start_time_date || event.eventStartTime;
  if (!startTime) return "";

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";

  // Use route from event or ticket email fields
  const route = event.route || event.eventRoute;
  const eventUrl = route ? `${baseUrl}/events/${route}` : baseUrl;

  const startDate = new Date(startTime);
  const endDate = new Date(startDate.getTime() + 90 * 60 * 1000); // 90 minutes default

  // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
  const formatGoogleDate = (date: Date) => {
    return date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  };

  // Use name from event or ticket email fields
  const eventName = event.name || event.eventName;
  const title = encodeURIComponent(
    `Stanford Speakers Bureau: ${eventName || "Speaker Event"}`,
  );

  // Build details - support both event desc and ticket-specific description
  let details =
    event.desc || event.eventDescription || "Stanford Speakers Bureau event";
  if (eventUrl) {
    details += `\n\nView Event: ${eventUrl}`;
  }
  // Add ticket-specific info if provided
  if (event.ticketEmail) {
    details += `\n\nTicket Email: ${event.ticketEmail}`;
  }
  if (event.ticketId) {
    details += `\n\nTicket ID: ${event.ticketId}`;
  }
  if (event.ticketType === "VIP") {
    details += "\nTicket Type: VIP";
  }
  const encodedDetails = encodeURIComponent(details);

  // Use venue from event or ticket email fields
  const location = encodeURIComponent(event.venue || event.eventVenue || "");
  const start = formatGoogleDate(startDate);
  const end = formatGoogleDate(endDate);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${encodedDetails}&location=${location}`;
}
