import {SendEmailCommand, SESv2Client} from "@aws-sdk/client-sesv2";
import QRCode from "qrcode";
import { PACIFIC_TIMEZONE } from "./constants";

// Initialize SES client
const sesClient = new SESv2Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || "hello@stanfordspeakersbureau.com";

type TicketEmailData = {
  email: string;
  eventName: string;
  ticketType: string;
  eventStartTime: string | null;
  eventRoute: string | null;
  ticketId: string;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
  eventDescription?: string | null;
};

/**
 * Escape text for iCalendar format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Format date for iCalendar (UTC format with Z suffix)
 */
function formatForICalUTC(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "") + "Z";
}

/**
 * Format date for iCalendar (local time format for Pacific Time)
 */
function formatForICalLocal(date: Date): string {
  // Convert UTC date to Pacific Time and get components
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  const hour = parts.find((p) => p.type === "hour")?.value || "";
  const minute = parts.find((p) => p.type === "minute")?.value || "";
  const second = parts.find((p) => p.type === "second")?.value || "";
  
  return `${year}${month}${day}T${hour}${minute}${second}`;
}

/**
 * Generate iCalendar (.ics) file content for calendar invite
 */
function generateICalContent(data: TicketEmailData): string {
  if (!data.eventStartTime) return "";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
  const eventUrl = data.eventRoute ? `${baseUrl}/events/${data.eventRoute}` : null;
  
  const startDate = new Date(data.eventStartTime);
  // Default to 90 minutes duration
  const endDate = new Date(startDate.getTime() + 90 * 60 * 1000);

  const title = `Stanford Speakers Bureau: ${data.eventName || "Speaker Event"}`;
  const location = data.eventVenue || "";
  
  // Build description with View Ticket link
  let description = data.eventDescription || "Stanford Speakers Bureau event";
  if (eventUrl) {
    description += `\\n\\nView Ticket: ${eventUrl}`;
  }
  description += `\\n\\nTicket ID: ${data.ticketId}`;
  if (data.ticketType === "VIP") {
    description += "\\nTicket Type: VIP";
  }

  const uid = `${formatForICalUTC(startDate)}-${data.ticketId}@stanfordspeakersbureau.org`;

  // Use Pacific Time with timezone identifier
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stanford Speakers Bureau//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:America/Los_Angeles",
    "BEGIN:STANDARD",
    "DTSTART:20071104T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "TZOFFSETFROM:-0700",
    "TZOFFSETTO:-0800",
    "TZNAME:PST",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:20070311T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "TZOFFSETFROM:-0800",
    "TZOFFSETTO:-0700",
    "TZNAME:PDT",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatForICalUTC(new Date())}`,
    `DTSTART;TZID=America/Los_Angeles:${formatForICalLocal(startDate)}`,
    `DTEND;TZID=America/Los_Angeles:${formatForICalLocal(endDate)}`,
    `SUMMARY:${escapeICalText(title)}`,
    `DESCRIPTION:${escapeICalText(description)}`,
    location ? `LOCATION:${escapeICalText(location)}` : "",
    eventUrl ? `URL:${eventUrl}` : "",
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter((line) => line !== "")
    .join("\r\n");

  return icsContent;
}

/**
 * Generate QR code as data URI for embedding in email
 */
async function generateQRCodeDataURI(ticketId: string): Promise<string> {
  try {
    return await QRCode.toDataURL(ticketId, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    // Return empty string if QR code generation fails
    return "";
  }
}

/**
 * Generate Google Calendar URL for ticket email
 */
function generateGoogleCalendarUrl(data: TicketEmailData): string {
  if (!data.eventStartTime) return "";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
  const eventUrl = data.eventRoute ? `${baseUrl}/events/${data.eventRoute}` : baseUrl;

  const startDate = new Date(data.eventStartTime);
  const endDate = new Date(startDate.getTime() + 90 * 60 * 1000); // 90 minutes default

  // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
  const formatGoogleDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };

  const title = encodeURIComponent(`Stanford Speakers Bureau: ${data.eventName || "Speaker Event"}`);
  let details = data.eventDescription || "Stanford Speakers Bureau event";
  if (eventUrl) {
    details += `\n\nView Event: ${eventUrl}`;
  }
  details += `\n\nTicket ID: ${data.ticketId}`;
  if (data.ticketType === "VIP") {
    details += "\nTicket Type: VIP";
  }
  const encodedDetails = encodeURIComponent(details);
  const location = encodeURIComponent(data.eventVenue || "");
  const start = formatGoogleDate(startDate);
  const end = formatGoogleDate(endDate);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${encodedDetails}&location=${location}`;
}

/**
 * Generate HTML email content for ticket confirmation
 */
async function generateTicketEmailHTML(
  data: TicketEmailData,
): Promise<string> {
  const { eventName, ticketType, eventStartTime, eventRoute, ticketId, eventVenue, eventVenueLink } = data;
  
  const formattedDate = eventStartTime
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: PACIFIC_TIMEZONE,
      }).format(new Date(eventStartTime))
    : "TBA";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;
  const logoUrl = `${baseUrl}/logo.png`;
  const googleCalendarUrl = generateGoogleCalendarUrl(data);

  // Generate QR code
  const qrCodeDataURI = await generateQRCodeDataURI(ticketId);
  const isVIP = ticketType?.toUpperCase() === "VIP";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your Ticket Confirmation</title>
  <style type="text/css">
    /* Mobile-first responsive styles */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        padding: 20px 15px !important;
        max-width: 100% !important;
      }
      .email-content {
        padding: 0 !important;
      }
      .email-header {
        padding: 30px 20px !important;
      }
      .logo {
        width: 50px !important;
        height: 50px !important;
      }
      .header-title {
        font-size: 20px !important;
      }
      .header-subtitle {
        font-size: 24px !important;
      }
      .details-card {
        padding: 20px 16px !important;
      }
      .details-title {
        font-size: 18px !important;
        margin-bottom: 16px !important;
      }
      .details-label {
        width: 100px !important;
        font-size: 13px !important;
        padding: 6px 0 !important;
      }
      .details-value {
        font-size: 13px !important;
        padding: 6px 0 !important;
      }
      .qr-section {
        padding: 20px 16px !important;
      }
      .qr-title {
        font-size: 18px !important;
        margin-bottom: 12px !important;
      }
      .qr-code-wrapper {
        padding: 12px !important;
      }
      .qr-code-img {
        width: 200px !important;
        height: 200px !important;
      }
      .button {
        padding: 10px 20px !important;
        font-size: 14px !important;
        width: auto !important;
        max-width: 100% !important;
        display: inline-block !important;
        text-align: center !important;
        margin: 0 auto !important;
      }
      .button-wrapper {
        padding: 0 10px !important;
      }
      .calendar-buttons td {
        padding: 5px !important;
        width: 50% !important;
      }
      .calendar-buttons a {
        width: 100% !important;
        max-width: 100% !important;
        padding: 10px 12px !important;
        font-size: 13px !important;
      }
      .footer {
        padding: 24px 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #18181b; color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #27272a;">
    <!-- Header -->
    <tr>
      <td align="center" class="email-header" style="background: linear-gradient(135deg, #A80D0C 0%, #C11211 100%); padding: 40px 30px; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="Stanford Speakers Bureau Logo" class="logo" style="width: 60px; height: 60px; margin: 0 auto; display: block;" />
        </div>
        <h2 class="header-subtitle" style="margin: 0 0 12px 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">Stanford Speakers Bureau</h2>
        <h1 class="header-title" style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Ticket Confirmed!</h1>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td align="center" class="email-container" style="padding: 40px 20px; max-width: 900px; width: 100%;">
        <div class="email-content" style="padding: 0;">
          <p style="margin: 0 0 24px 0; color: #f4f4f5; font-size: 16px; line-height: 1.6;">
            Thank you for your ticket purchase. Your ticket has been confirmed!
          </p>
          
          ${googleCalendarUrl ? `
          <!-- Add to Google Calendar Button -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td align="center" class="button-wrapper" style="padding: 0;">
                <a href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer" class="button" style="display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background-color: #4285F4; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  <svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Add to Google Calendar
                </a>
              </td>
            </tr>
          </table>
          ` : ""}
          
          <!-- Ticket Details Card -->
          <div class="details-card" style="background-color: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <h2 class="details-title" style="margin: 0 0 20px 0; color: #ffffff; font-size: 22px; font-weight: 600;">Event Details</h2>
            
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; width: 120px; vertical-align: top;">Event:</td>
                <td class="details-value" style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500;">${eventName || "Event"}</td>
              </tr>
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">Date & Time:</td>
                <td class="details-value" style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500;">${formattedDate}</td>
              </tr>
              ${eventVenue ? `
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">Location:</td>
                <td class="details-value" style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500;">
                  ${eventVenueLink ? `<a href="${eventVenueLink}" target="_blank" rel="noopener noreferrer" style="color: #A80D0C; text-decoration: none; border-bottom: 1px solid #A80D0C;">${eventVenue}</a>` : eventVenue}
                </td>
              </tr>
              ` : ""}
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">Ticket Type:</td>
                <td class="details-value" style="padding: 8px 0;">
                  <span style="display: inline-block; padding: 4px 12px; background-color: ${ticketType === "VIP" ? "#A80D0C" : "#71717a"}; color: #ffffff; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                    ${ticketType || "STANDARD"}
                  </span>
                </td>
              </tr>
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">Ticket ID:</td>
                <td class="details-value" style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-family: monospace; word-break: break-all;">${ticketId}</td>
              </tr>
            </table>
          </div>
          
          ${qrCodeDataURI ? `
          <!-- QR Code Section -->
          <div class="qr-section" style="background-color: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
            <h2 class="qr-title" style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Your Ticket QR Code</h2>
            <div class="qr-code-wrapper" style="display: inline-block; background-color: #ffffff; padding: ${isVIP ? "20px" : "16px"}; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); ${isVIP ? "border: 4px solid #A80D0C;" : ""}">
              <img src="${qrCodeDataURI}" alt="Ticket QR Code" class="qr-code-img" style="display: block; width: 250px; height: 250px; max-width: 100%; height: auto;" />
            </div>
            ${isVIP ? `
            <div style="margin-top: 12px;">
              <span style="display: inline-block; padding: 6px 16px; background-color: #A80D0C; color: #ffffff; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                VIP
              </span>
            </div>
            ` : ""}
            <p style="margin: 16px 0 0 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
              Show this QR code at the event entrance for quick check-in.
            </p>
          </div>
          ` : ""}
          
          ${eventUrl ? `
          <!-- View Event Button -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td align="center" class="button-wrapper" style="padding: 0;">
                <a href="${eventUrl}" class="button" style="display: inline-block; padding: 14px 28px; background-color: #A80D0C; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Event Details</a>
              </td>
            </tr>
          </table>
          ` : ""}

          <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
            Please bring a valid ID and this confirmation email to the event. We look forward to seeing you there!
          </p>
        </div>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td align="center" class="footer" style="padding: 30px; background-color: #18181b; border-top: 1px solid #3f3f46; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px;">
          Stanford Speakers Bureau
        </p>
        <p style="margin: 0; color: #71717a; font-size: 12px;">
          If you have any questions, please contact us at <a href="mailto:${FROM_EMAIL}" style="color: #a1a1aa; text-decoration: none;">${FROM_EMAIL}</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email content for ticket confirmation
 */
function generateTicketEmailText(data: TicketEmailData): string {
  const { eventName, ticketType, eventStartTime, eventRoute, ticketId } = data;
  
  const formattedDate = eventStartTime
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: PACIFIC_TIMEZONE,
      }).format(new Date(eventStartTime))
    : "TBA";

  const eventUrl = eventRoute
    ? `${process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com"}/events/${eventRoute}`
    : null;

  return `
Ticket Confirmed!

Thank you for your ticket purchase. Your ticket has been confirmed!

Event Details:
- Event: ${eventName || "Event"}
- Date & Time: ${formattedDate}
- Ticket Type: ${ticketType || "STANDARD"}
- Ticket ID: ${ticketId}
${eventUrl ? `- Event URL: ${eventUrl}` : ""}

Please bring a valid ID and this confirmation email to the event. We look forward to seeing you there!

Stanford Speakers Bureau
If you have any questions, please contact us at ${FROM_EMAIL}
  `.trim();
}

/**
 * Send ticket confirmation email via AWS SES
 * Throws an error if email sending fails
 */
export async function sendTicketEmail(data: TicketEmailData): Promise<void> {
  const htmlContent = await generateTicketEmailHTML(data);
  const textContent = generateTicketEmailText(data);
  
  // Generate ICS file content for calendar invite
  const icsContent = generateICalContent(data);
  
  // Build attachments array
  const attachments = [];
  if (icsContent) {
    const icsBuffer = Buffer.from(icsContent, "utf-8");
    attachments.push({
      FileName: `stanford-speakers-bureau-event.ics`,
      RawContent: new Uint8Array(icsBuffer),
      ContentType: "text/calendar; charset=utf-8",
    });
  }

  const command = new SendEmailCommand({
    FromEmailAddress: FROM_EMAIL,
    Destination: {
      ToAddresses: [data.email],
    },
    Content: {
      Simple: {
        Subject: {
          Data: `Your Ticket Confirmation - ${data.eventName || "Event"}`,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: htmlContent,
            Charset: "UTF-8",
          },
          Text: {
            Data: textContent,
            Charset: "UTF-8",
          },
        },
        ...(attachments.length > 0 && {
          Attachments: attachments,
        }),
      },
    },
  });

  await sesClient.send(command);
  console.log(`Ticket confirmation email sent to ${data.email}`);
}


