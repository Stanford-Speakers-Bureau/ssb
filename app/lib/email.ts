import type { QRCodeToBufferOptions } from "qrcode";
import QRCode from "qrcode";
import { PACIFIC_TIMEZONE, REFERRAL_MESSAGE } from "./constants";
import { generateGoogleCalendarUrl, generateReferralCode } from "./utils";

// emails are so stupid
// on ios gmail to fix: https://www.hteumeuleu.com/2021/fixing-gmail-dark-mode-css-blend-modes/

// AWS SES configuration
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

/**
 * AWS Signature Version 4 signing for SES API requests
 * This replaces the heavy @aws-sdk/client-sesv2 package (~300KB) with ~5KB of code
 */
async function signAWSRequest(
  method: string,
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<Record<string, string>> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials not configured");
  }

  const urlObj = new URL(url);
  const host = urlObj.host;
  const path = urlObj.pathname;
  const service = "ses";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  // Create canonical request
  const canonicalHeaders = Object.entries({
    ...headers,
    host,
    "x-amz-date": amzDate,
  })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
    .join("\n");

  const signedHeaders = Object.keys({
    ...headers,
    host,
    "x-amz-date": amzDate,
  })
    .map((k) => k.toLowerCase())
    .sort()
    .join(";");

  const payloadHash = await sha256Hex(body);

  const canonicalRequest = [
    method,
    path,
    "", // query string (empty for POST)
    canonicalHeaders + "\n",
    signedHeaders,
    payloadHash,
  ].join("\n");

  // Create string to sign
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  // Calculate signature
  const signingKey = await getSignatureKey(
    AWS_SECRET_ACCESS_KEY,
    dateStamp,
    AWS_REGION,
    service,
  );
  const signature = await hmacHex(signingKey, stringToSign);

  // Create authorization header
  const authorization = `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    authorization,
  };
}

async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const encoder = new TextEncoder();
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

async function hmacHex(key: ArrayBuffer, message: string): Promise<string> {
  const result = await hmac(key, message);
  return Array.from(new Uint8Array(result))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmac(
    encoder.encode("AWS4" + secretKey).buffer as ArrayBuffer,
    dateStamp,
  );
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/**
 * Send raw email via AWS SES REST API
 */
async function sendRawEmailViaSES(rawMessage: string): Promise<void> {
  const endpoint = `https://email.${AWS_REGION}.amazonaws.com/v2/email/outbound-emails`;

  const body = JSON.stringify({
    Content: {
      Raw: {
        Data: btoa(rawMessage),
      },
    },
  });

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  const signedHeaders = await signAWSRequest("POST", endpoint, body, headers);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: signedHeaders,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SES API error (${response.status}): ${errorText}`);
  }
}

const FROM_EMAIL =
  process.env.SES_FROM_EMAIL || "hello@stanfordspeakersbureau.com";

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

// Wrap base64 (or any long) strings to 76-character lines for MIME compatibility
function wrapToMimeLines(input: string, lineLength: number = 76): string {
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += lineLength) {
    chunks.push(input.slice(i, i + lineLength));
  }
  return chunks.join("\r\n");
}

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
  return (
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "") + "Z"
  );
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

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
  const eventUrl = data.eventRoute
    ? `${baseUrl}/events/${data.eventRoute}`
    : null;

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
  return [
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
}

/**
 * Generate QR code PNG as a Buffer for attaching to an email
 */
async function generateQRCodePngBuffer(
  ticketId: string,
): Promise<Buffer | null> {
  try {
    const options: QRCodeToBufferOptions = {
      errorCorrectionLevel: "H",
      type: "png",
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    };
    return await QRCode.toBuffer(ticketId, options);
  } catch (error) {
    console.error("Error generating QR code buffer:", error);
    return null;
  }
}

/**
 * Generate HTML email content for ticket confirmation
 */
async function generateTicketEmailHTML(
  data: TicketEmailData,
  options?: { qrCid?: string },
): Promise<string> {
  const {
    eventName,
    ticketType,
    eventStartTime,
    eventRoute,
    ticketId,
    eventVenue,
    eventVenueLink,
  } = data;

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

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;
  const logoUrl = `${baseUrl}/logo.png`;
  const googleCalendarUrl = generateGoogleCalendarUrl({
    eventName: data.eventName,
    eventStartTime: data.eventStartTime,
    eventRoute: data.eventRoute,
    eventVenue: data.eventVenue,
    eventDescription: data.eventDescription,
    ticketId: data.ticketId,
    ticketType: data.ticketType,
  });

  const referralCode = generateReferralCode(data.email);
  const referralUrl =
    referralCode && data.eventRoute
      ? `${baseUrl}/events/${data.eventRoute}?referral_code=${referralCode}`
      : null;

  const qrImageSrc = options?.qrCid ? `cid:${options.qrCid}` : "";
  const isVIP = ticketType?.toUpperCase() === "VIP";

  // Gmail-specific wrapper for enforcing white text in dark mode
  const gmailBlendStart = `<span class="gmail-blend-screen"><span class="gmail-blend-difference">`;
  const gmailBlendEnd = `</span></span>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Your Ticket Confirmation</title>
  <style type="text/css">
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }

    /* ========================================= */
    /* GMAIL DARK MODE FIX (blend mode)          */
    /* ========================================= */
    /* Only applies in Gmail - uses blend modes to force white text */
    u + .body .gmail-blend-screen { 
      background: #000; 
      mix-blend-mode: screen; 
      display: block;
      width: 100%;
    }
    
    u + .body .gmail-blend-difference { 
      background: #000; 
      mix-blend-mode: difference; 
      display: block;
      color: #f4f4f5;
      width: 100%;
      padding: 0;
    }

    /* Gmail dark mode color overrides with linear gradients */
    u + .body .email-container { 
      background-color: #27272a !important; 
      background-image: linear-gradient(#27272a, #27272b) !important;
    }
    u + .body .details-card, 
    u + .body .qr-section,
    u + .body .footer { 
      background-color: #18181b !important; 
      background-image: linear-gradient(#18181b, #18181c) !important;
    }
    u + .body .qr-code-wrapper { 
      background-color: #A80D0C !important; 
      background-image: linear-gradient(180deg, #A80D0C, #A80D0D) !important;
    }
    u + .body .ticket-type-vip { 
      background-color: #A80D0C !important; 
      background-image: linear-gradient(#A80D0C, #A80D0D) !important;
      color: #ffffff !important; 
    }
    u + .body .ticket-type-standard { 
      background-color: #71717a !important; 
      background-image: linear-gradient(#71717a, #71717b) !important;
      color: #ffffff !important; 
    }
    u + .body .button { 
      background-color: #A80D0C !important; 
      background-image: linear-gradient(#A80D0C, #A80D0D) !important;
      color: #ffffff !important; 
    }
    u + .body .button-calendar { 
      background-color: #175dcd !important; 
      background-image: linear-gradient(#175dcd, #175dce) !important;
      color: #ffffff !important; 
    }
    u + .body a { color: #A80D0C !important; }

    /* VIP Gold accent borders */
    u + .body .vip-border { 
      border-color: #D4AF37 !important; 
    }
    u + .body .vip-shadow { 
      box-shadow: 0 0 15px rgba(212, 175, 55, 0.3) !important;
    }

    /* Standard dark mode support (for non-Gmail clients) */
    @media (prefers-color-scheme: dark) {
      body, table, td, div, p, span, h1, h2, h3 {
        color: #f4f4f5 !important;
      }
      .email-container { background-color: #27272a !important; }
      .email-header { background: linear-gradient(135deg, #A80D0C 0%, #C11211 100%) !important; }
      .details-card { background-color: #18181b !important; }
      .qr-section { background-color: #18181b !important; }
      .footer { background-color: #18181b !important; border-top: 1px solid #3f3f46 !important; }
      .vip-border { border-color: #D4AF37 !important; }
      .vip-shadow { box-shadow: 0 0 15px rgba(212, 175, 55, 0.3) !important; }
    }

    /* Mobile responsive */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding: 20px 15px !important; }
      .email-header { padding: 30px 20px !important; }
      .logo { width: 50px !important; height: 50px !important; }
      .header-title { font-size: 20px !important; }
      .header-subtitle { font-size: 24px !important; }
      .details-card { padding: 20px 16px !important; }
      .qr-code-img { width: 280px !important; height: auto !important; }
      .button { display: inline-block !important; margin: 0 auto !important; }
      .wallet-buttons td { display: block !important; width: 100% !important; padding: 8px 0 !important; }
    }
  </style>
</head>
<body class="body" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #18181b; color: #f4f4f5;">

  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #27272a;${isVIP ? " border: 3px solid #D4AF37;" : ""}">
    
    <!-- Header -->
    <tr>
      <td align="center" class="email-header" style="background: linear-gradient(135deg, #A80D0C 0%, #C11211 100%); padding: 40px 30px; text-align: center;${isVIP ? " border: 3px solid #D4AF37; border-bottom: none;" : ""}">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="Stanford Speakers Bureau Logo" class="logo" style="width: 60px; height: 60px; margin: 0 auto; display: block;" />
        </div>
        ${gmailBlendStart}
          <h2 class="header-subtitle" style="margin: 0 0 12px 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">Stanford Speakers Bureau</h2>
          <h1 class="header-title" style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${isVIP ? "Your VIP ticket is reserved!" : "Your seat is reserved!"}</h1>
        ${gmailBlendEnd}
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 40px 20px; max-width: 900px; width: 100%;">
        <div class="email-content" style="padding: 0; max-width: 600px; margin: 0 auto;">
          
          ${gmailBlendStart}
            ${
              isVIP
                ? `
            <p style="margin: 0 0 16px 0; color: #f4f4f5; font-size: 16px; line-height: 1.6;">
              When you arrive at the event, please use the VIP entrance.
              <br>
              We've reserved a seat for you in the front few rows.
            </p>
            `
                : ""
            }
            <p style="margin: 0 0 24px 0; color: #f4f4f5; font-size: 16px; line-height: 1.6;">
              Your ticket is enclosed below. We can't wait to see you!
            </p>
          ${gmailBlendEnd}
          
          <!-- Event Details Card -->
          <div class="details-card" style="background-color: #18181b; padding: 24px; margin-bottom: 24px;${isVIP ? " border: 2px solid #D4AF37; border-radius: 8px; box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);" : ""}">
            
            ${gmailBlendStart}
              <h2 class="details-title" style="margin: 0 0 20px 0; color: #ffffff; font-size: 22px; font-weight: 600;">Event Details</h2>
            ${gmailBlendEnd}
            
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; width: 120px; vertical-align: top;">
                  ${gmailBlendStart}Event:${gmailBlendEnd}
                </td>
                <td class="details-value" style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500;">
                  ${gmailBlendStart}${eventName || "Event"}${gmailBlendEnd}
                </td>
              </tr>
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">
                  ${gmailBlendStart}Date & Time:${gmailBlendEnd}
                </td>
                <td class="details-value" style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500;">
                  ${gmailBlendStart}${formattedDate}${gmailBlendEnd}
                </td>
              </tr>
              ${
                eventVenue
                  ? `
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">
                  ${gmailBlendStart}Location:${gmailBlendEnd}
                </td>
                <td class="details-value" style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500;">
                  ${
                    eventVenueLink
                      ? `<a href="${eventVenueLink}" target="_blank" rel="noopener noreferrer" style="color: #A80D0C; text-decoration: none; border-bottom: 1px solid #A80D0C;">${eventVenue}</a>`
                      : `${gmailBlendStart}${eventVenue}${gmailBlendEnd}`
                  }
                </td>
              </tr>
              `
                  : ""
              }
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">
                  ${gmailBlendStart}Ticket Type:${gmailBlendEnd}
                </td>
                <td class="details-value" style="padding: 8px 0;">
                  <span class="${ticketType === "VIP" ? "ticket-type-vip" : "ticket-type-standard"}" style="display: inline-block; padding: 4px 12px; background-color: ${ticketType === "VIP" ? "#A80D0C" : "#71717a"}; color: #ffffff; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                    ${ticketType || "STANDARD"}
                  </span>
                </td>
              </tr>
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">
                  ${gmailBlendStart}Ticket ID:${gmailBlendEnd}
                </td>
                <td class="details-value" style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-family: monospace; word-break: break-all;">
                  ${gmailBlendStart}${ticketId}${gmailBlendEnd}
                </td>
              </tr>
              ${
                referralCode && !(ticketType.toUpperCase() == "VIP")
                  ? `
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">
                  ${gmailBlendStart}Referral Code:${gmailBlendEnd}
                </td>
                <td class="details-value" style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500; font-family: monospace;">
                  ${gmailBlendStart}${referralCode}${gmailBlendEnd}
                </td>
              </tr>
              <tr>
                <td class="details-label" style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">
                  ${gmailBlendStart}Referral Link:${gmailBlendEnd}
                </td>
                <td class="details-value" style="padding: 8px 0;">
                  <a href="${referralUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 14px; color: #A80D0C; text-decoration: none; border-bottom: 1px solid #A80D0C;">${referralUrl}</a>
                </td>
              </tr>
              `
                  : ""
              }
            </table>
            
            ${
              referralCode && !(ticketType.toUpperCase() == "VIP")
                ? `
            <div style="margin-top: 20px; padding: 16px 0; text-align: center; border-top: 1px solid #3f3f46;">
              ${gmailBlendStart}
                <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 700; line-height: 1.6;">
                  ${REFERRAL_MESSAGE}
                </p>
              ${gmailBlendEnd}
              ${gmailBlendStart}
                <p style="margin: 8px 0 0 0; color: #71717a; font-size: 12px; line-height: 1.4;">
                  Note: all referrals must be checked in to earn your front row seat!
                </p>
              ${gmailBlendEnd}
            </div>
            `
                : ""
            }
            
            ${
              eventUrl
                ? `
            <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr>
                <td align="center" class="button-wrapper" style="padding: 0;">
                  <a href="${eventUrl}" class="button" style="display: inline-block; padding: 14px 28px; background-color: #A80D0C; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;${isVIP ? " border: 2px solid #D4AF37;" : ""}">View Event Details</a>
                </td>
              </tr>
            </table>
            `
                : ""
            }
          </div>
          
          ${
            qrImageSrc
              ? `
          <!-- QR Code Section -->
          <div class="qr-section" style="background-color: #18181b; padding: 24px; margin-bottom: 24px; text-align: center;${isVIP ? " border: 2px solid #D4AF37; border-radius: 8px; box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);" : ""}">
            
            ${gmailBlendStart}
              <h2 class="qr-title" style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Your Ticket QR Code</h2>
            ${gmailBlendEnd}

            <div class="qr-code-wrapper" style="display: inline-block; border-radius: 12px; ${
              isVIP ? "background-color: #A80D0C; padding: 4px;" : "padding: 0;"
            }">
              <div style="background-color: #ffffff; padding: 16px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
                <img src="${qrImageSrc}" alt="Ticket QR Code" class="qr-code-img" style="display: block; width: 350px; max-width: 100%; height: auto;" />
              </div>
            </div>

            ${
              isVIP
                ? `
            <div style="margin-top: 12px;">
              <span style="display: inline-block; padding: 6px 16px; background-color: #A80D0C; color: #ffffff; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                VIP
              </span>
            </div>
            `
                : ""
            }
            
            <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="margin-top: 16px;">
              <tr>
                <td align="right" width="50%" style="padding-right: 4px;">
                  <a href="${baseUrl}/api/tickets/apple-wallet?ticket_id=${ticketId}" target="_blank" rel="noopener noreferrer">
                    <img src="${baseUrl}/images/add-to-apple-wallet.png" alt="Add to Apple Wallet" width="auto" height="48" style="display: block; height: 48px; border: 0;" />
                  </a>
                </td>
                <td align="left" width="50%" style="padding-left: 4px;">
                  <a href="${baseUrl}/api/tickets/google-wallet?ticket_id=${ticketId}" target="_blank" rel="noopener noreferrer">
                    <img src="${baseUrl}/images/enUS_add_to_google_wallet_add-wallet-badge.png" alt="Add to Google Wallet" width="auto" height="48" style="display: block; height: 48px; border: 0;" />
                  </a>
                </td>
              </tr>
            </table>
                        
            ${gmailBlendStart}
              <p style="margin: 16px 0 0 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
                Show this QR code at the event entrance for quick check-in.
              </p>
            ${gmailBlendEnd}

          </div>
          `
              : ""
          }

          ${gmailBlendStart}
            <p style="margin: 0 0 24px 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
              Please bring a valid ID and this confirmation email to the event. We look forward to seeing you there!
            </p>
          ${gmailBlendEnd}
          
          ${
            googleCalendarUrl
              ? `
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td align="center" class="button-wrapper" style="padding: 0;">
                <a href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer" class="button button-calendar" style="display: inline-flex; align-items: center; gap: 10px; padding: 10px 20px; background-color: #175dcd; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                  <img src="${baseUrl}/g.png" alt="Google" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 8px;" />
                  Add to Google Calendar
                </a>
              </td>
            </tr>
          </table>
          `
              : ""
          }
        </div>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td align="center" class="footer" style="padding: 30px; background-color: #18181b; border-top: 1px solid #3f3f46; text-align: center;">
        ${gmailBlendStart}
          <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px;">
            Stanford Speakers Bureau
          </p>
          <p style="margin: 0; color: #71717a; font-size: 12px;">
            If you have any questions, please contact us at <a href="mailto:${FROM_EMAIL}" style="color: #a1a1aa; text-decoration: none;">${FROM_EMAIL}</a>
          </p>
        ${gmailBlendEnd}
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

  // Generate referral code from email
  const referralCode = generateReferralCode(data.email);
  const referralUrl =
    referralCode && data.eventRoute
      ? `${process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com"}/events/${data.eventRoute}?referral_code=${referralCode}`
      : null;

  return `
${ticketType?.toUpperCase() === "VIP" ? "VIP Ticket Confirmed!" : "Ticket Confirmed!"}

Thank you for your ticket purchase. Your ticket has been confirmed!

${ticketType?.toUpperCase() === "VIP" ? "We've reserved a seat for you in the front few rows. When you arrive at the event, please use the VIP entrance.\n\n" : ""}Event Details:
- Event: ${eventName || "Event"}
- Date & Time: ${formattedDate}
- Ticket Type: ${ticketType || "STANDARD"}
- Ticket ID: ${ticketId}
${eventUrl ? `- Event URL: ${eventUrl}` : ""}

${referralCode && !(ticketType.toUpperCase() == "VIP") ? `- Your Referral Code: ${referralCode}` : ""}
${referralUrl && !(ticketType.toUpperCase() == "VIP") ? `- Your Referral Link: ${referralUrl}` : ""}
${REFERRAL_MESSAGE}

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
  // Check if email sending is disabled
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() == "true") {
    console.log(
      `Email sending is disabled (DISABLE_EMAIL=true). Skipping email to ${data.email}`,
    );
    return;
  }

  const subject = data.eventName
    ? `Your Ticket for ${data.eventName} is enclosed!`
    : "Your Ticket is enclosed!";
  const textContent = generateTicketEmailText(data);

  // Generate QR and prepare cid
  const qrCid = `ticket-qr-${data.ticketId}@stanfordspeakersbureau`;
  const qrBuffer = await generateQRCodePngBuffer(data.ticketId);
  const htmlContent = await generateTicketEmailHTML(data, {
    qrCid: qrBuffer ? qrCid : undefined,
  });

  // Optional ICS content
  const icsContent = generateICalContent(data);
  const icsBuffer = icsContent ? Buffer.from(icsContent, "utf-8") : null;

  // Build MIME message with CID image inside multipart/related for HTML part
  const mixBoundary = `mix_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const relBoundary = `rel_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const lines: string[] = [];
  lines.push(
    `From: ${FROM_EMAIL}`,
    `To: ${data.email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${mixBoundary}"`,
    "",
    `--${mixBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    textContent,
    "",
  );

  if (qrBuffer) {
    // multipart/related containing HTML and inline image
    const qrBase64 = wrapToMimeLines(qrBuffer.toString("base64"));
    lines.push(
      `--${altBoundary}`,
      `Content-Type: multipart/related; boundary="${relBoundary}"`,
      "",
      `--${relBoundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      "",
      htmlContent,
      "",
      `--${relBoundary}`,
      `Content-Type: image/png; name="ticket-qr.png"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: inline; filename="ticket-qr.png"`,
      `Content-ID: <${qrCid}>`,
      "",
      qrBase64,
      "",
      `--${relBoundary}--`,
      "",
    );
  } else {
    // No QR image; include HTML directly
    lines.push(
      `--${altBoundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      "",
      htmlContent,
      "",
    );
  }

  // Close alternative part
  lines.push(`--${altBoundary}--`);

  // Attach ICS file (optional)
  if (icsBuffer) {
    const icsBase64 = wrapToMimeLines(icsBuffer.toString("base64"));
    lines.push(
      `--${mixBoundary}`,
      `Content-Type: text/calendar; charset="utf-8"; name="stanford-speakers-bureau-event.ics"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="stanford-speakers-bureau-event.ics"`,
      "",
      icsBase64,
      "",
    );
  }

  lines.push(`--${mixBoundary}--`, "");

  const rawMessage = lines.join("\r\n");

  await sendRawEmailViaSES(rawMessage);
  console.log(`Ticket confirmation email sent to ${data.email}`);
}
