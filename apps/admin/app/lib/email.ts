import QRCode from "qrcode";
import { db, eq, roles } from "@ssb/db";
import { buildCancellationLink } from "./cancellation-links";
import { parseCancelCalloutText } from "./cancelCallout";
import { IMPORTANT_NOTICE_ITEMS, PACIFIC_TIMEZONE } from "./constants";
import { buildEventImageToken } from "./image-links";
import {
  buildAnnounceUnsubscribeLink,
  buildEventUnsubscribeLink,
  buildNewsletterUnsubscribeLink,
} from "./unsubscribe-links";
import { hasUnsafeHeaderChars, isValidEmail } from "./validation";
import { buildAppleWalletLink } from "./wallet-links";
import { generateGoogleCalendarUrl } from "./utils";

type FooterContext =
  | { kind: "unsub"; url: string; label: string }
  | { kind: "essential"; eventName: string };

function eventUnsubFooter(input: {
  email: string;
  eventId?: string | null;
  eventName?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}): FooterContext | null {
  if (!input.eventId) return null;
  const url = buildEventUnsubscribeLink({
    baseUrl: getBaseUrl(),
    email: input.email,
    eventId: input.eventId,
    eventStartTime: input.eventStartTime ?? null,
    eventEndTime: input.eventEndTime ?? null,
  });
  const eventName = input.eventName?.trim() || "this event";
  return {
    kind: "unsub",
    url,
    label: `Unsubscribe from emails about ${eventName}`,
  };
}

function announceUnsubFooter(input: { email: string }): FooterContext {
  return {
    kind: "unsub",
    url: buildAnnounceUnsubscribeLink({
      baseUrl: getBaseUrl(),
      email: input.email,
    }),
    label: "Unsubscribe from announcements",
  };
}

function newsletterUnsubFooter(input: { email: string }): FooterContext {
  return {
    kind: "unsub",
    url: buildNewsletterUnsubscribeLink({
      baseUrl: getBaseUrl(),
      email: input.email,
    }),
    label: "Unsubscribe from the newsletter",
  };
}

function essentialFooter(
  eventName: string | null | undefined,
): FooterContext {
  return {
    kind: "essential",
    eventName: eventName?.trim() || "this event",
  };
}

async function isEmailSuppressed(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const row = await db.query.roles.findFirst({
    where: eq(roles.email, normalized),
    columns: { roles: true },
  });
  if (!row?.roles) return false;
  return row.roles
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .includes("email_suppression");
}

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
async function sendRawEmailViaSES(
  rawMessage: string,
  recipientEmail: string,
  skipSuppressionCheck = false,
): Promise<void> {
  // Mass-send routes partition recipients via `partitionBySuppression` up front,
  // so they pass `skipSuppressionCheck` to avoid an extra per-recipient DB query
  // (see email-suppression.ts). One-off sends keep the per-send safety net.
  if (!skipSuppressionCheck && (await isEmailSuppressed(recipientEmail))) {
    console.log(
      `[email] Skipping send to suppressed address: ${recipientEmail}`,
    );
    return;
  }

  const endpoint = `https://email.${AWS_REGION}.amazonaws.com/v2/email/outbound-emails`;

  const body = JSON.stringify({
    Content: {
      Raw: {
        // Use Buffer for proper UTF-8 to base64 encoding (btoa fails with Unicode chars like emojis)
        Data: Buffer.from(rawMessage, "utf-8").toString("base64"),
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

  await response.body?.cancel();
}

const FROM_EMAIL =
  process.env.SES_FROM_EMAIL || "tickets@stanfordspeakersbureau.com";

// Default calendar event duration (90 minutes)
const CALENDAR_DEFAULT_DURATION_MS = 90 * 60 * 1000;

// Wrap base64 (or any long) strings to 76-character lines for MIME compatibility
function wrapToMimeLines(input: string, lineLength: number = 76): string {
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += lineLength) {
    chunks.push(input.slice(i, i + lineLength));
  }
  return chunks.join("\r\n");
}

function buildUtf8MimeBodyPart(
  contentType: string,
  content: string,
): string[] {
  return [
    `Content-Type: ${contentType}; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    wrapToMimeLines(Buffer.from(content, "utf-8").toString("base64")),
    "",
  ];
}

// ============================================================================
// Date / time formatting helpers (matching the web InfoPills format)
// ============================================================================

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/** Format date as "January 23rd, 2026" (matching the web event page) */
function formatPillDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = parseInt(
    date.toLocaleDateString("en-US", { day: "numeric", timeZone: PACIFIC_TIMEZONE }),
  );
  const suffix = getOrdinalSuffix(day);
  return date
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: PACIFIC_TIMEZONE,
    })
    .replace(/\d+/, `${day}${suffix}`);
}

/** Format time as "7:30 PM" (matching the web event page) */
function formatPillTime(dateString: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PACIFIC_TIMEZONE,
  });
}

/**
 * Build the "Doors open at X and close promptly at Y" clause, omitting whichever
 * time is unavailable. Returns "" when neither is known — never invents a default.
 */
function buildDoorsClause(doorsOpen: string | null, doorsClose: string | null): string {
  if (doorsOpen && doorsClose) {
    return `Doors open at ${doorsOpen} and close promptly at ${doorsClose}`;
  }
  if (doorsOpen) return `Doors open at ${doorsOpen}`;
  if (doorsClose) return `Doors close promptly at ${doorsClose}`;
  return "";
}

/** Format full date+time as "Thursday, January 23, 2026 at 8:00 PM" */
function formatFullDateTime(dateString: string | null): string {
  if (!dateString) return "TBA";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PACIFIC_TIMEZONE,
  }).format(new Date(dateString));
}

/** Format exact date+time as "Thursday, January 23, 2026 at 8:00 PM" */
function formatFullDateTimeWithTimezone(dateString: string | null): string {
  if (!dateString) return "TBA";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PACIFIC_TIMEZONE,
  }).format(new Date(dateString));
}

function formatTicketDropTime(dateString: string | null): string {
  if (!dateString) return "TBA";
  const d = new Date(dateString);
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: PACIFIC_TIMEZONE,
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PACIFIC_TIMEZONE,
  }).format(d);
  return `${day} &middot; ${time}`;
}

// ============================================================================
// Gmail dark mode blend helpers
// ============================================================================

const gmailBlendStart = `<span class="gmail-blend-screen"><span class="gmail-blend-difference">`;
const gmailBlendEnd = `</span></span>`;

// ============================================================================
// Shared email template building blocks
// ============================================================================

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
}

/** Generates the shared <style> block for all emails */
function buildEmailStyles(opts?: { isVIP?: boolean; isExternal?: boolean }): string {
  return `
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }

    /* Gmail Dark Mode Fix (blend mode) */
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

    /* Gmail dark mode color overrides */
    u + .body .email-container {
      background-color: #27272a !important;
      background-image: linear-gradient(#27272a, #27272b) !important;
    }
    u + .body .details-card,
    u + .body .qr-section,
    u + .body .hero-info,
    u + .body .footer {
      background-color: #18181b !important;
      background-image: linear-gradient(#18181b, #18181c) !important;
    }
    u + .body .important-box {
      background-color: #18181b !important;
      background-image: linear-gradient(#18181b, #18181c) !important;
      border-color: #A80D0C !important;
    }
    u + .body .qr-code-wrapper {
      background-color: #A80D0C !important;
      background-image: linear-gradient(180deg, #A80D0C, #A80D0D) !important;
    }
    u + .body .qr-code-wrapper-vip {
      background-color: #D4AF37 !important;
      background-image: linear-gradient(180deg, #D4AF37, #D4A017) !important;
    }
    u + .body .qr-code-wrapper-external {
      background-color: #16a34a !important;
      background-image: linear-gradient(180deg, #16a34a, #16a34b) !important;
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
    u + .body .ticket-type-external {
      background-color: #16a34a !important;
      background-image: linear-gradient(#16a34a, #16a34b) !important;
      color: #ffffff !important;
    }
    u + .body .position-badge {
      background-color: #A80D0C !important;
      background-image: linear-gradient(#A80D0C, #A80D0D) !important;
      color: #ffffff !important;
    }
    u + .body .pill {
      background-color: #2a2a2e !important;
      background-image: linear-gradient(#2a2a2e, #2a2a2f) !important;
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

    ${opts?.isVIP ? `
    u + .body .vip-border { border-color: #D4AF37 !important; }
    u + .body .vip-shadow { box-shadow: 0 0 15px rgba(212, 175, 55, 0.3) !important; }
    ` : ""}
    ${opts?.isExternal ? `
    u + .body .external-border { border-color: #16a34a !important; }
    u + .body .external-shadow { box-shadow: 0 0 15px rgba(22, 163, 74, 0.3) !important; }
    ` : ""}

    /* Standard dark mode (non-Gmail) */
    @media (prefers-color-scheme: dark) {
      body, table, td, div, p, span, h1, h2, h3 {
        color: #f4f4f5 !important;
      }
      .email-container { background-color: #27272a !important; }
      .hero-info { background-color: #18181b !important; }
      .details-card { background-color: #18181b !important; }
      .qr-section { background-color: #18181b !important; }
      .footer { background-color: #18181b !important; border-top: 1px solid #3f3f46 !important; }
      ${opts?.isVIP ? `.vip-border { border-color: #D4AF37 !important; }
      .vip-shadow { box-shadow: 0 0 15px rgba(212, 175, 55, 0.3) !important; }` : ""}
      ${opts?.isExternal ? `.external-border { border-color: #16a34a !important; }
      .external-shadow { box-shadow: 0 0 15px rgba(22, 163, 74, 0.3) !important; }` : ""}
    }

    /* Mobile responsive */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding: 20px 12px !important; }
      .hero-info { padding: 20px 16px 16px !important; }
      .hero-title { font-size: 24px !important; }
      .details-card { padding: 20px 16px !important; }
      .qr-code-img { width: 260px !important; height: auto !important; }
      .button { display: inline-block !important; margin: 0 auto !important; }
      .wallet-buttons td { display: block !important; width: 100% !important; padding: 8px 0 !important; }
    }
  `;
}

/** Wraps the full HTML document shell around body content */
function buildEmailShell(title: string, styles: string, bodyContent: string): string {
  const baseUrl = getBaseUrl();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style type="text/css">${styles}</style>
</head>
<body class="body" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #18181b; color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #27272a;">
    <tr>
      <td align="center" style="padding: 24px 20px 12px; background-color: #27272a;">
        <div style="max-width: 600px; margin: 0 auto;">
          <a href="${baseUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; text-decoration: none;">
            <img src="${baseUrl}/logo.png" alt="Stanford Speakers Bureau" width="46" height="46" style="display: block; margin: 0 auto;" />
          </a>
        </div>
      </td>
    </tr>
    ${bodyContent}
  </table>
</body>
</html>`;
}

/** Builds the event hero card: image + title + tagline + info pills */
function buildHeroCard(data: {
  eventName: string;
  eventTagline?: string | null;
  eventStartTime?: string | null;
  doorsOpenTime?: string | null;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
  eventId?: string | null;
  imgVersion?: number | null;
  isVIP?: boolean;
  isExternal?: boolean;
}): string {
  const baseUrl = getBaseUrl();
  // Carry a signed token so the hero image still renders for unreleased
  // ("mystery") events: the web image route 404s those unless the token
  // verifies. See app/lib/image-links.ts.
  const imageUrl = data.eventId
    ? `${baseUrl}/api/images/${data.eventId}?v=${data.imgVersion || 1}&t=${buildEventImageToken(data.eventId)}`
    : null;

  const accentBorder = data.isVIP
    ? "border-top: 4px solid #D4AF37;"
    : data.isExternal
      ? "border-top: 4px solid #16a34a;"
      : "border-top: 4px solid #A80D0C;";

  const pills = buildInfoPills(data);

  return `
    <!-- Hero Card -->
    <tr>
      <td align="center" style="padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; overflow: hidden;">
          ${imageUrl ? `
          <!-- Event Image -->
          <img src="${imageUrl}" alt="${data.eventName}" width="600" style="width: 100%; height: auto; display: block;" />
          ` : `
          <!-- No image fallback: SSB branded header -->
          <div style="background: linear-gradient(135deg, #A80D0C 0%, #C11211 100%); padding: 24px; text-align: center;">
            ${gmailBlendStart}
              <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Stanford Speakers Bureau</p>
            ${gmailBlendEnd}
          </div>
          `}
          <!-- Title + Tagline + Pills -->
          <div class="hero-info" style="background-color: #18181b; padding: 24px 24px 20px; ${accentBorder}">
            ${gmailBlendStart}
              <h1 class="hero-title" style="margin: 0 0 6px 0; color: #ffffff; font-size: 28px; font-weight: 700; font-family: Georgia, 'Times New Roman', Times, serif; line-height: 1.2;">${data.eventName}</h1>
            ${gmailBlendEnd}
            ${data.eventTagline ? `
            ${gmailBlendStart}
              <p style="margin: 0 0 4px 0; color: #a1a1aa; font-size: 15px; line-height: 1.5;">${markdownToEmailHTML(data.eventTagline)}</p>
            ${gmailBlendEnd}
            ` : ""}
            ${pills}
          </div>
        </div>
      </td>
    </tr>`;
}

/** Builds the info pills row (date, doors open, venue) */
function buildInfoPills(data: {
  eventStartTime?: string | null;
  doorsOpenTime?: string | null;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
}): string {
  const pills: string[] = [];

  if (data.eventStartTime) {
    pills.push(`
      <td style="padding: 0 6px 6px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td class="pill" style="background-color: #2a2a2e; border: 1px solid #3f3f46; border-radius: 50px; padding: 5px 12px; font-size: 13px; color: #e4e4e7; font-weight: 500; white-space: nowrap;">
            <span style="color: #f87171; font-size: 13px; vertical-align: middle;">&#128197;</span>&nbsp;${formatPillDate(data.eventStartTime)}
          </td>
        </tr></table>
      </td>`);
  }

  if (data.doorsOpenTime) {
    pills.push(`
      <td style="padding: 0 6px 6px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td class="pill" style="background-color: #2a2a2e; border: 1px solid #3f3f46; border-radius: 50px; padding: 5px 12px; font-size: 13px; color: #e4e4e7; font-weight: 500; white-space: nowrap;">
            <span style="color: #f87171; font-size: 13px; vertical-align: middle;">&#128682;</span>&nbsp;Doors open ${formatPillTime(data.doorsOpenTime)}
          </td>
        </tr></table>
      </td>`);
  }

  if (data.eventVenue) {
    const venueContent = data.eventVenueLink
      ? `<a href="${data.eventVenueLink}" target="_blank" rel="noopener noreferrer" style="color: #e4e4e7; text-decoration: none;"><span style="color: #f87171; font-size: 13px; vertical-align: middle;">&#128205;</span>&nbsp;${data.eventVenue}</a>`
      : `<span style="color: #f87171; font-size: 13px; vertical-align: middle;">&#128205;</span>&nbsp;${data.eventVenue}`;
    pills.push(`
      <td style="padding: 0 6px 6px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td class="pill" style="background-color: #2a2a2e; border: 1px solid #3f3f46; border-radius: 50px; padding: 5px 12px; font-size: 13px; color: #e4e4e7; font-weight: 500; white-space: nowrap;">
            ${venueContent}
          </td>
        </tr></table>
      </td>`);
  }

  if (pills.length === 0) return "";

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top: 14px;">
      <tr>${pills.join("")}</tr>
    </table>`;
}

/**
 * Generates the HTML for the "Important" notice block.
 * Accepts optional extra HTML strings to append after the base items.
 */
function buildImportantNotice(
  extraItems?: string[],
): string {
  const allItems = [
    ...IMPORTANT_NOTICE_ITEMS.map(
      (item) =>
        `<b><span style="display: inline-block; vertical-align: middle; margin-right: 8px;">${item.emoji}</span>${item.text}</b>`,
    ),
    ...(extraItems || []),
  ];

  const itemsHTML = allItems
    .map((content, i) => {
      const marginStyle = i < allItems.length - 1 ? ' style="margin-bottom: 8px;"' : "";
      return `<div${marginStyle}>${content}</div>`;
    })
    .join("\n");

  return `
    <div class="important-box" style="background-color: #18181b; border: 3px solid #A80D0C; padding: 20px 24px; margin-bottom: 24px; border-radius: 8px; text-align: center;">
      ${gmailBlendStart}
        <h2 style="margin: 0 0 12px 0; color: #A80D0C; font-size: 18px; font-weight: 700; text-transform: uppercase;"><b>Before You Arrive</b></h2>
        <div style="color: #f4f4f5; font-size: 15px; line-height: 1.8;">
          ${itemsHTML}
        </div>
      ${gmailBlendEnd}
    </div>`;
}

/** Generates plain text "Important" notice */
function buildImportantNoticeText(): string {
  return `BEFORE YOU ARRIVE:\n${IMPORTANT_NOTICE_ITEMS.map((item) => `- ${item.text}`).join("\n")}`;
}

function standbyNoticeLines(startTimeStr?: string | null): string[] {
  const admitClause = startTimeStr
    ? `Standby admission is first come, first served — we'll start admitting from the standby line closer to the event start time, around ${startTimeStr}.`
    : "Standby admission is first come, first served — we'll start admitting from the standby line closer to the event start time.";
  return [
    "This is a standby ticket, and admission is not guaranteed.",
    "Please wait in the standby ticket area when you arrive.",
    admitClause,
    "Your QR code isn't active yet. It will appear on your ticket page once standby admission opens at the venue.",
  ];
}

/** Builds a prominent standby notice box for standby ticket emails */
function buildStandbyNotice(startTimeStr?: string | null): string {
  const lines = standbyNoticeLines(startTimeStr);
  const itemsHTML = lines
    .map(
      (text, i) =>
        `<div${i < lines.length - 1 ? ' style="margin-bottom: 8px;"' : ""}>${text}</div>`,
    )
    .join("\n");

  return `
    <div class="important-box" style="background-color: #18181b; border: 3px solid #d97706; padding: 20px 24px; margin-bottom: 24px; border-radius: 8px; text-align: center;">
      ${gmailBlendStart}
        <h2 style="margin: 0 0 12px 0; color: #f59e0b; font-size: 18px; font-weight: 700; text-transform: uppercase;"><b>Standby Ticket</b></h2>
        <div style="color: #f4f4f5; font-size: 15px; line-height: 1.8;">
          ${itemsHTML}
        </div>
      ${gmailBlendEnd}
    </div>`;
}

/** Generates plain text standby notice */
function buildStandbyNoticeText(startTimeStr?: string | null): string {
  return `STANDBY TICKET:\n${standbyNoticeLines(startTimeStr)
    .map((line) => `- ${line}`)
    .join("\n")}`;
}

/** Builds a prominent date/time callout card */
function buildDateTimeCallout(opts: {
  eyebrow: string;
  value: string;
  subtitle?: string;
}): string {
  return `
    <div style="background-color: #18181b; border: 1px solid #A80D0C; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center; box-shadow: inset 0 0 0 1px rgba(193, 18, 17, 0.15);">
      ${gmailBlendStart}
        <p style="margin: 0 0 10px 0; color: #f87171; font-size: 12px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase;">${opts.eyebrow}</p>
        <h2 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; line-height: 1.3; font-family: Georgia, 'Times New Roman', Times, serif;">${opts.value}</h2>
        ${opts.subtitle ? `<p style="margin: 12px 0 0 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">${opts.subtitle}</p>` : ""}
      ${gmailBlendEnd}
    </div>`;
}

/** Builds the event details card with label/value rows */
function buildDetailsCard(opts: {
  rows: { label: string; value: string; isLink?: boolean; href?: string }[];
  ticketTypeBadge?: { type: string };
  actionButtonHref?: string | null;
  actionButtonLabel?: string;
  isVIP?: boolean;
  isExternal?: boolean;
}): string {
  const borderStyle = opts.isVIP
    ? "border: 2px solid #D4AF37; border-radius: 8px; box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);"
    : opts.isExternal
      ? "border: 2px solid #16a34a; border-radius: 8px; box-shadow: 0 0 15px rgba(22, 163, 74, 0.3);"
      : "border-radius: 8px;";

  const rowsHTML = opts.rows
    .map((row) => {
      const valueHTML = row.isLink && row.href
        ? `<a href="${row.href}" target="_blank" rel="noopener noreferrer" style="color: #A80D0C; text-decoration: none; border-bottom: 1px solid #A80D0C;">${row.value}</a>`
        : `${gmailBlendStart}${row.value}${gmailBlendEnd}`;
      return `
        <tr>
          <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px; width: 120px; vertical-align: top;">
            ${gmailBlendStart}${row.label}${gmailBlendEnd}
          </td>
          <td style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500;">
            ${valueHTML}
          </td>
        </tr>`;
    })
    .join("");

  const badgeHTML = opts.ticketTypeBadge
    ? `<tr>
        <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px; vertical-align: top;">
          ${gmailBlendStart}Ticket Type:${gmailBlendEnd}
        </td>
        <td style="padding: 8px 0;">
          <span class="${opts.ticketTypeBadge.type === "VIP" ? "ticket-type-vip" : opts.ticketTypeBadge.type === "EXTERNAL" ? "ticket-type-external" : "ticket-type-standard"}" style="display: inline-block; padding: 4px 12px; background-color: ${opts.ticketTypeBadge.type === "VIP" ? "#A80D0C" : opts.ticketTypeBadge.type === "EXTERNAL" ? "#16a34a" : "#71717a"}; color: #ffffff; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
            ${opts.ticketTypeBadge.type || "STANDARD"}
          </span>
        </td>
      </tr>`
    : "";

  const buttonHTML = opts.actionButtonHref
    ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <tr>
          <td align="center">
            <a href="${opts.actionButtonHref}" class="button" style="display: inline-block; padding: 14px 28px; background-color: #A80D0C; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;${opts.isVIP ? " border: 2px solid #D4AF37;" : opts.isExternal ? " border: 2px solid #16a34a;" : ""}">${opts.actionButtonLabel || "View Event Details"}</a>
          </td>
        </tr>
      </table>`
    : "";

  return `
    <div class="details-card${opts.isVIP ? " vip-border vip-shadow" : opts.isExternal ? " external-border external-shadow" : ""}" style="background-color: #18181b; padding: 24px; margin-bottom: 24px; ${borderStyle}">
      ${gmailBlendStart}
        <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 22px; font-weight: 600;">Event Details</h2>
      ${gmailBlendEnd}
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        ${rowsHTML}
        ${badgeHTML}
      </table>
      ${buttonHTML}
    </div>`;
}

/** Builds the QR code + wallet buttons section */
function buildQRSection(opts: {
  qrImageSrc: string;
  ticketType: string;
  ticketId: string;
  appleWalletUrl?: string | null;
  ticketValidTime?: string;
  ticketValidDate?: string;
  attendeeName?: string;
  isVIP?: boolean;
  isExternal?: boolean;
}): string {
  const baseUrl = getBaseUrl();
  const borderStyle = opts.isVIP
    ? "border: 2px solid #D4AF37; border-radius: 8px; box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);"
    : opts.isExternal
      ? "border: 2px solid #16a34a; border-radius: 8px; box-shadow: 0 0 15px rgba(22, 163, 74, 0.3);"
      : "border-radius: 8px;";

  const qrWrapperClass = opts.isVIP
    ? "qr-code-wrapper qr-code-wrapper-vip"
    : opts.isExternal
      ? "qr-code-wrapper qr-code-wrapper-external"
      : "qr-code-wrapper";
  const qrWrapperBg = opts.isVIP
    ? "background-color: #D4AF37; padding: 4px;"
    : opts.isExternal
      ? "background-color: #16a34a; padding: 4px;"
      : "padding: 0;";

  const typeBadge = opts.isVIP
    ? `<div style="margin-top: 12px;">
        <span style="display: inline-block; padding: 6px 16px; background-color: #D4AF37; color: #1a1a1a; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase;">VIP</span>
      </div>`
    : opts.isExternal
      ? `<div style="margin-top: 12px;">
          <span style="display: inline-block; padding: 6px 16px; background-color: #16a34a; color: #ffffff; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase;">EXTERNAL</span>
        </div>`
      : "";

  const validityText = opts.ticketValidTime && opts.ticketValidDate
    ? `${gmailBlendStart}
        <p style="margin: 16px 0 0 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
          Ticket valid until <span style="font-weight: bold; color: #e4e4e7;">${opts.ticketValidTime}</span> on <span style="font-weight: bold; color: #e4e4e7;">${opts.ticketValidDate}</span> for <span style="font-weight: bold; color: #e4e4e7;">${opts.attendeeName || "you"}</span>. We recommend arriving early to avoid long lines!
        </p>
      ${gmailBlendEnd}`
    : "";
  const appleWalletButton = opts.appleWalletUrl
    ? `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="margin-top: 16px;">
        <tr>
          <td align="center">
            <a href="${opts.appleWalletUrl}" target="_blank" rel="noopener noreferrer">
              <img src="${baseUrl}/images/add-to-apple-wallet.png" alt="Add to Apple Wallet" width="auto" height="48" style="display: inline-block; height: 48px; border: 0;" />
            </a>
          </td>
        </tr>
      </table>`
    : "";

  return `
    <div class="qr-section${opts.isVIP ? " vip-border vip-shadow" : opts.isExternal ? " external-border external-shadow" : ""}" style="background-color: #18181b; padding: 24px; margin-bottom: 24px; text-align: center; ${borderStyle}">
      ${gmailBlendStart}
        <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Your Ticket QR Code</h2>
      ${gmailBlendEnd}
      <div class="${qrWrapperClass}" style="display: inline-block; border-radius: 12px; ${qrWrapperBg}">
        <div style="background-color: #ffffff; padding: 16px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
          <img src="${opts.qrImageSrc}" alt="Ticket QR Code" class="qr-code-img" style="display: block; width: 350px; max-width: 100%; height: auto;" />
        </div>
      </div>
      ${typeBadge}
      ${appleWalletButton}
      ${validityText}
    </div>`;
}

/** Builds the Google Calendar button */
function buildCalendarButton(googleCalendarUrl: string): string {
  const baseUrl = getBaseUrl();
  return `
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td align="center">
          <a href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer" class="button button-calendar" style="display: inline-flex; align-items: center; gap: 10px; padding: 10px 20px; background-color: #175dcd; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            <img src="${baseUrl}/g.png" alt="Google" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 8px;" />
            Add to Google Calendar
          </a>
        </td>
      </tr>
    </table>`;
}

/** Builds a centered CTA button */
function buildButton(href: string, label: string, opts?: { style?: string }): string {
  return `
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td align="center">
          <a href="${href}" class="button" style="display: inline-block; padding: 14px 28px; background-color: #A80D0C; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;${opts?.style || ""}">${label}</a>
        </td>
      </tr>
    </table>`;
}

/** Builds a text paragraph inside the content area */
function buildParagraph(text: string, opts?: { color?: string; fontSize?: string; fontWeight?: string; marginBottom?: string }): string {
  const color = opts?.color || "#f4f4f5";
  const fontSize = opts?.fontSize || "16px";
  const fontWeight = opts?.fontWeight || "normal";
  const marginBottom = opts?.marginBottom || "24px";
  return `${gmailBlendStart}<p style="margin: 0 0 ${marginBottom} 0; color: ${color}; font-size: ${fontSize}; font-weight: ${fontWeight}; line-height: 1.6;">${text}</p>${gmailBlendEnd}`;
}

/** Builds a prominent cancel-ticket banner shown at the very top of non-VIP/non-external emails */
function buildCancelBanner(cancelTicketUrl: string): string {
  return `
    <tr>
      <td align="center" style="padding: 12px 20px 8px; background-color: #27272a;">
        <div style="max-width: 600px; margin: 0 auto;">
          <div style="background-color: #18181b; border: 2px solid #A80D0C; border-radius: 8px; padding: 14px 20px; text-align: center;">
            <p style="margin: 0; color: #d4d4d8; font-size: 14px; font-weight: 600; line-height: 1.5;">Can&rsquo;t make it? <a href="${cancelTicketUrl}" style="color: #A80D0C; text-decoration: underline; font-weight: 700;">Please cancel</a> so someone else can attend.</p>
          </div>
        </div>
      </td>
    </tr>`;
}

/** Builds the email footer */
function buildFooter(ctx?: FooterContext | null): string {
  let extraLine = "";
  if (ctx?.kind === "unsub") {
    extraLine = `
          <p style="margin: 12px 0 0 0; color: #71717a; font-size: 12px;">
            <a href="${ctx.url}" style="color: #a1a1aa; text-decoration: underline;">${ctx.label}</a>
          </p>`;
  } else if (ctx?.kind === "essential") {
    extraLine = `
          <p style="margin: 12px 0 0 0; color: #71717a; font-size: 12px; line-height: 1.5;">
            This is an event-essential update. You&rsquo;re receiving it because you got a ticket to <span style="color: #a1a1aa;">${ctx.eventName}</span>.
          </p>`;
  }

  return `
    <tr>
      <td align="center" class="footer" style="padding: 30px; background-color: #18181b; border-top: 1px solid #3f3f46; text-align: center;">
        ${gmailBlendStart}
          <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px;">Stanford Speakers Bureau</p>
          <p style="margin: 0; color: #71717a; font-size: 12px;">
            For ADA accommodations or other questions, please email <a href="mailto:${FROM_EMAIL}" style="color: #a1a1aa; text-decoration: none;">${FROM_EMAIL}</a>
          </p>${extraLine}
        ${gmailBlendEnd}
      </td>
    </tr>`;
}

// ============================================================================
// iCalendar generation
// ============================================================================

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatForICalUTC(date: Date): string {
  return (
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "") + "Z"
  );
}

function formatForICalLocal(date: Date): string {
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

function generateICalContent(data: TicketEmailData): string {
  if (!data.eventStartTime) return "";

  const baseUrl = getBaseUrl();
  const eventUrl = data.eventRoute
    ? `${baseUrl}/events/${data.eventRoute}`
    : null;

  const startDate = new Date(data.eventStartTime);
  if (Number.isNaN(startDate.getTime())) return "";

  const defaultEndDate = new Date(startDate.getTime() + CALENDAR_DEFAULT_DURATION_MS);
  let endDate = defaultEndDate;
  if (data.eventEndTime) {
    const parsedEndDate = new Date(data.eventEndTime);
    if (!Number.isNaN(parsedEndDate.getTime())) {
      endDate = parsedEndDate;
    }
  }

  const title = `Stanford Speakers Bureau: ${data.eventName || "Speaker Event"}`;
  const location = data.eventVenue || "";

  let description = data.eventDescription || "Stanford Speakers Bureau event";
  if (eventUrl) {
    description += `\\n\\nView Ticket: ${eventUrl}`;
  }
  description += `\\n\\nTicket ID: ${data.ticketId}`;
  if (data.ticketType === "VIP") {
    description += "\\nTicket Type: VIP";
  }

  const uid = `${formatForICalUTC(startDate)}-${data.ticketId}@stanfordspeakersbureau.org`;

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

// ============================================================================
// QR Code generation
// ============================================================================
//
// `qrcode`'s `toBuffer` only exists in its Node ("server") build. Cloudflare
// Workers resolves the package's `browser` field, which omits `toBuffer`, so we
// encode the PNG ourselves: `QRCode.create` (present in both builds) yields the
// module matrix, and the Web-standard CompressionStream produces the
// zlib-compressed IDAT payload. Pure JS — no pngjs, no Node streams.

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// PNG chunk: length + type + data + CRC32(type+data), all big-endian.
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

// CompressionStream("deflate") emits a zlib stream (RFC 1950) — exactly the
// format a PNG IDAT chunk expects.
async function deflateToZlib(input: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== "undefined") {
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter();
    void writer.write(input as BufferSource);
    void writer.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  }

  const { deflateSync } = await import("node:zlib");
  return new Uint8Array(deflateSync(input));
}

async function generateQRCodePngBuffer(
  ticketId: string,
): Promise<Buffer | null> {
  try {
    const dark: [number, number, number] = [0, 0, 0]; // #000000
    const light: [number, number, number] = [255, 255, 255]; // #FFFFFF
    const margin = 2; // quiet-zone width, in modules
    const targetWidth = 400; // desired image width, in px

    const qr = QRCode.create(ticketId, { errorCorrectionLevel: "H" });
    const count = qr.modules.size;
    const modules = qr.modules.data;
    // Integer scale keeps every module a uniform, crisp size.
    const scale = Math.max(1, Math.floor(targetWidth / (count + margin * 2)));
    const dim = (count + margin * 2) * scale;

    // Raw image: each row is one filter byte (0 = None, left as the array's
    // zero-init) followed by RGB triplets.
    const rowBytes = 1 + dim * 3;
    const raw = new Uint8Array(rowBytes * dim);
    for (let y = 0; y < dim; y++) {
      const my = Math.floor(y / scale) - margin;
      const rowStart = y * rowBytes;
      for (let x = 0; x < dim; x++) {
        const mx = Math.floor(x / scale) - margin;
        const isDark =
          my >= 0 &&
          my < count &&
          mx >= 0 &&
          mx < count &&
          modules[my * count + mx] !== 0;
        const color = isDark ? dark : light;
        const px = rowStart + 1 + x * 3;
        raw[px] = color[0];
        raw[px + 1] = color[1];
        raw[px + 2] = color[2];
      }
    }

    const ihdr = new Uint8Array(13);
    const ihdrView = new DataView(ihdr.buffer);
    ihdrView.setUint32(0, dim); // width
    ihdrView.setUint32(4, dim); // height
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type 2 = truecolor RGB
    // bytes 10-12 (compression / filter / interlace) stay 0

    const idat = await deflateToZlib(raw);

    const ihdrChunk = pngChunk("IHDR", ihdr);
    const idatChunk = pngChunk("IDAT", idat);
    const iendChunk = pngChunk("IEND", new Uint8Array(0));

    const png = new Uint8Array(
      PNG_SIGNATURE.length +
      ihdrChunk.length +
      idatChunk.length +
      iendChunk.length,
    );
    let offset = 0;
    for (const part of [PNG_SIGNATURE, ihdrChunk, idatChunk, iendChunk]) {
      png.set(part, offset);
      offset += part.length;
    }

    return Buffer.from(png);
  } catch (error) {
    console.error("Error generating QR code buffer:", error);
    return null;
  }
}

// ============================================================================
// Ticket confirmation email
// ============================================================================

type TicketEmailData = {
  email: string;
  name?: string | null;
  eventName: string;
  ticketType: string;
  eventStartTime: string | null;
  eventEndTime?: string | null;
  eventRoute: string | null;
  ticketId: string;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
  eventDescription?: string | null;
  doorsOpenTime?: string | null;
  eventId?: string | null;
  imgVersion?: number | null;
  eventTagline?: string | null;
  cancelTicketUrl?: string | null;
  appleWalletUrl?: string | null;
};

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
    doorsOpenTime,
  } = data;

  const baseUrl = getBaseUrl();
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;
  const cancelTicketUrl = data.cancelTicketUrl ?? null;
  const appleWalletUrl = data.appleWalletUrl ?? null;
  const isVIP = ticketType?.toUpperCase() === "VIP";
  const isExternal = ticketType?.toUpperCase() === "EXTERNAL";
  const isStandby = ticketType?.toUpperCase() === "STANDBY";

  const formattedDate = formatFullDateTime(eventStartTime);
  const formattedDoorsOpen = doorsOpenTime ? formatPillTime(doorsOpenTime) : null;

  const qrImageSrc = options?.qrCid ? `cid:${options.qrCid}` : "";

  const ticketValidTime = eventStartTime
    ? new Date(eventStartTime).toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: PACIFIC_TIMEZONE,
    })
    : "";
  const ticketValidDate = eventStartTime
    ? new Date(eventStartTime).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
    })
    : "";
  const attendeeName = data.name?.trim() || "you";

  const googleCalendarUrl = generateGoogleCalendarUrl({
    eventName: data.eventName,
    eventStartTime: data.eventStartTime,
    eventEndTime: data.eventEndTime,
    eventRoute: data.eventRoute,
    eventVenue: data.eventVenue,
    eventDescription: data.eventDescription,
    ticketId: data.ticketId,
    ticketType: data.ticketType,
  });

  // Build detail rows
  const detailRows: { label: string; value: string; isLink?: boolean; href?: string }[] = [];
  if (data.name) detailRows.push({ label: "Name:", value: data.name });
  detailRows.push({ label: "Event:", value: eventName || "Event" });
  detailRows.push({ label: "Date & Time:", value: formattedDate });
  if (formattedDoorsOpen) detailRows.push({ label: "Doors Open:", value: formattedDoorsOpen });
  if (eventVenue) {
    detailRows.push({
      label: "Location:",
      value: eventVenue,
      isLink: !!eventVenueLink,
      href: eventVenueLink || undefined,
    });
  }
  detailRows.push({
    label: "Ticket ID:",
    value: `<span style="font-family: monospace; word-break: break-all;">${ticketId}</span>`,
  });

  // Assemble content sections
  const heroCard = buildHeroCard({
    eventName,
    eventTagline: data.eventTagline,
    eventStartTime,
    doorsOpenTime,
    eventVenue,
    eventVenueLink,
    eventId: data.eventId,
    imgVersion: data.imgVersion,
    isVIP,
    isExternal,
  });

  const cancelBanner = !isVIP && !isExternal && cancelTicketUrl
    ? buildCancelBanner(cancelTicketUrl)
    : "";

  const contentSections: string[] = [];

  // Standby notice (replaces the standard "before you arrive" box) or the
  // regular important notice
  if (isStandby) {
    contentSections.push(buildStandbyNotice(ticketValidTime || null));
  } else {
    contentSections.push(buildImportantNotice(undefined));
  }

  // VIP welcome
  if (isVIP) {
    contentSections.push(buildParagraph(
      "Use the VIP entrance when you arrive &mdash; we've saved you a front-row seat.",
    ));
  }
  else if (isStandby) {
    contentSections.push(buildParagraph(
      "Your standby ticket is reserved. Head to the venue and wait in the standby area &mdash; we hope to see you inside!",
    ));
  }
  else {
    // Non VIP Welcome message
    contentSections.push(buildParagraph("Your ticket is confirmed &mdash; we can't wait to see you!"));
  }

  // Cancel ticket message + button (VIP/External only — regular tickets use the top banner)
  if (isVIP || isExternal) {
    contentSections.push(buildParagraph(
      "Can't make it? Please cancel so someone else can attend.",
    ));
    if (cancelTicketUrl) {
      contentSections.push(buildButton(cancelTicketUrl, "Cancel Ticket"));
    }
  }

  // Event details card
  contentSections.push(buildDetailsCard({
    rows: detailRows,
    ticketTypeBadge: { type: ticketType || "STANDARD" },
    actionButtonHref: eventUrl,
    isVIP,
    isExternal,
  }));

  // QR code section
  if (qrImageSrc) {
    contentSections.push(buildQRSection({
      qrImageSrc,
      ticketType: ticketType || "STANDARD",
      ticketId,
      appleWalletUrl,
      ticketValidTime,
      ticketValidDate,
      attendeeName,
      isVIP,
      isExternal,
    }));
  }

  // Calendar button
  if (googleCalendarUrl) {
    contentSections.push(buildCalendarButton(googleCalendarUrl));
  }

  const bodyContent = `
    ${cancelBanner}
    ${heroCard}
    <!-- Content -->
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter()}`;

  return buildEmailShell(
    "Your Ticket Confirmation",
    buildEmailStyles({ isVIP, isExternal }),
    bodyContent,
  );
}

function generateTicketEmailText(data: TicketEmailData): string {
  const { eventName, ticketType, eventStartTime, eventRoute, ticketId, doorsOpenTime } = data;

  const formattedDate = formatFullDateTime(eventStartTime);
  const formattedDoorsOpen = doorsOpenTime ? formatPillTime(doorsOpenTime) : null;
  const baseUrl = getBaseUrl();
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;
  const cancelTicketUrl = data.cancelTicketUrl ?? null;

  const isVIP = ticketType?.toUpperCase() === "VIP";
  const isExternal = ticketType?.toUpperCase() === "EXTERNAL";
  const isStandby = ticketType?.toUpperCase() === "STANDBY";
  const standbyStartTime = eventStartTime
    ? new Date(eventStartTime).toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: PACIFIC_TIMEZONE,
      })
    : null;
  const cancelLine = cancelTicketUrl
    ? `Can't make it? Please cancel so someone else can attend.\nCancel Ticket: ${cancelTicketUrl}`
    : "";

  return `
${!isVIP && !isExternal && cancelLine ? `${cancelLine}\n\n---\n` : ""}${isVIP ? "VIP Ticket Confirmed!" : isExternal ? "External Ticket Confirmed!" : isStandby ? "Standby Ticket Reserved!" : "Ticket Confirmed!"}

${isStandby ? "Your standby ticket is reserved. Head to the venue and wait in the standby area — we hope to see you inside!" : "Your ticket is confirmed — we can't wait to see you!"}

${isStandby ? `${buildStandbyNoticeText(standbyStartTime)}\n\n` : ""}${isVIP ? "Use the VIP entrance when you arrive — we've saved you a front-row seat.\n\n" : ""}Event Details:
${data.name ? `- Name: ${data.name}\n` : ""}- Event: ${eventName || "Event"}
- Date & Time: ${formattedDate}
${formattedDoorsOpen ? `- Doors Open: ${formattedDoorsOpen}\n` : ""}- Ticket Type: ${ticketType || "STANDARD"}
- Ticket ID: ${ticketId}
${eventUrl ? `- Event URL: ${eventUrl}` : ""}

${buildImportantNoticeText()}
${isVIP || isExternal ? `\n${cancelLine}` : ""}

Stanford Speakers Bureau
For ADA accommodations or other questions, please email ${FROM_EMAIL}
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

  const isStandby = data.ticketType?.toUpperCase() === "STANDBY";
  const subject = isStandby
    ? data.eventName
      ? `Your standby ticket for ${data.eventName} is reserved`
      : "Your standby ticket is reserved"
    : data.eventName
      ? `Your Ticket for ${data.eventName} is enclosed!`
      : "Your Ticket is enclosed!";
  const cancelTicketUrl = await buildCancellationLink({
    baseUrl: getBaseUrl(),
    email: data.email,
    ticketId: data.ticketId,
    eventStartTime: data.eventStartTime,
    eventEndTime: data.eventEndTime ?? null,
  });
  const appleWalletUrl = await buildAppleWalletLink({
    baseUrl: getBaseUrl(),
    email: data.email,
    ticketId: data.ticketId,
    eventStartTime: data.eventStartTime,
    eventEndTime: data.eventEndTime ?? null,
  });
  const renderData: TicketEmailData = {
    ...data,
    cancelTicketUrl,
    appleWalletUrl,
  };
  const textContent = generateTicketEmailText(renderData);

  // Generate QR and prepare cid. Standby tickets have no scannable QR until
  // staff open admission at the venue, so we omit it from the email entirely.
  const qrCid = `ticket-qr-${data.ticketId}@stanfordspeakersbureau`;
  const qrBuffer = isStandby
    ? null
    : await generateQRCodePngBuffer(data.ticketId);
  const htmlContent = await generateTicketEmailHTML(renderData, {
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
    ...buildUtf8MimeBodyPart("text/plain", textContent),
  );

  if (qrBuffer) {
    // multipart/related containing HTML and inline image
    const qrBase64 = wrapToMimeLines(qrBuffer.toString("base64"));
    lines.push(
      `--${altBoundary}`,
      `Content-Type: multipart/related; boundary="${relBoundary}"`,
      "",
      `--${relBoundary}`,
      ...buildUtf8MimeBodyPart("text/html", htmlContent),
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
      ...buildUtf8MimeBodyPart("text/html", htmlContent),
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

  await sendRawEmailViaSES(rawMessage, data.email);
  console.log(`Ticket confirmation email sent to ${data.email}`);
}

// ============================================================================
// Day-of reminder email
// ============================================================================

type DayOfReminderEmailData = TicketEmailData & {
  doorsOpenTime?: string | null;
};

async function generateDayOfReminderEmailHTML(
  data: DayOfReminderEmailData,
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
    doorsOpenTime,
  } = data;

  const baseUrl = getBaseUrl();
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;
  const cancelTicketUrl = data.cancelTicketUrl ?? null;
  const isVIP = ticketType?.toUpperCase() === "VIP";
  const isExternal = ticketType?.toUpperCase() === "EXTERNAL";

  const formattedDate = formatFullDateTime(doorsOpenTime || eventStartTime);
  const formattedDoorsOpen = doorsOpenTime ? formatPillTime(doorsOpenTime) : null;
  const formattedClose = eventStartTime ? formatPillTime(eventStartTime) : null;
  const doorsClause = buildDoorsClause(formattedDoorsOpen, formattedClose);

  const qrImageSrc = options?.qrCid ? `cid:${options.qrCid}` : "";
  const ticketValidTime = eventStartTime
    ? new Date(eventStartTime).toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: PACIFIC_TIMEZONE,
    })
    : "";
  const ticketValidDate = eventStartTime
    ? new Date(eventStartTime).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: PACIFIC_TIMEZONE,
    })
    : "";
  const attendeeName = data.name?.trim() || "you";

  const googleCalendarUrl = generateGoogleCalendarUrl({
    eventName: data.eventName,
    eventStartTime: data.eventStartTime,
    eventEndTime: data.eventEndTime,
    eventRoute: data.eventRoute,
    eventVenue: data.eventVenue,
    eventDescription: data.eventDescription,
    ticketId: data.ticketId,
    ticketType: data.ticketType,
  });

  // Build detail rows
  const detailRows: { label: string; value: string; isLink?: boolean; href?: string }[] = [];
  if (data.name) detailRows.push({ label: "Name:", value: data.name });
  detailRows.push({ label: "Event:", value: eventName || "Event" });
  detailRows.push({ label: "Date & Time:", value: formattedDate });
  if (eventVenue) {
    detailRows.push({
      label: "Location:",
      value: eventVenue,
      isLink: !!eventVenueLink,
      href: eventVenueLink || undefined,
    });
  }
  detailRows.push({
    label: "Ticket ID:",
    value: `<span style="font-family: monospace; word-break: break-all;">${ticketId}</span>`,
  });

  // Assemble content sections
  const heroCard = buildHeroCard({
    eventName,
    eventTagline: data.eventTagline,
    eventStartTime,
    doorsOpenTime,
    eventVenue,
    eventVenueLink,
    eventId: data.eventId,
    imgVersion: data.imgVersion,
    isVIP,
    isExternal,
  });

  const cancelBanner = !isVIP && !isExternal && cancelTicketUrl
    ? buildCancelBanner(cancelTicketUrl)
    : "";

  const contentSections: string[] = [];

  // Important notice (with standby line extra item)
  contentSections.push(buildImportantNotice(
    [`If you have friends without tickets, they should come and wait on the standby line!`],
  ));

  // VIP welcome
  if (isVIP) {
    contentSections.push(buildParagraph(
      "Use the VIP entrance when you arrive &mdash; we've saved you a front-row seat.",
    ));
  }

  // Excitement message
  contentSections.push(buildParagraph(
    `See you tonight!${doorsClause ? ` ${doorsClause} &mdash; don't be late, no late entry allowed.` : ""}`,
  ));

  // Cancel ticket message + button (VIP/External only — regular tickets use the top banner)
  if (isVIP || isExternal) {
    contentSections.push(buildParagraph(
      "Can't make it? Please cancel so someone else can attend.",
    ));
    if (cancelTicketUrl) {
      contentSections.push(buildButton(cancelTicketUrl, "Cancel Ticket"));
    }
  }

  // Event details card
  contentSections.push(buildDetailsCard({
    rows: detailRows,
    ticketTypeBadge: { type: ticketType || "STANDARD" },
    actionButtonHref: eventUrl,
    isVIP,
    isExternal,
  }));

  // QR code section
  if (qrImageSrc) {
    contentSections.push(buildQRSection({
      qrImageSrc,
      ticketType: ticketType || "STANDARD",
      ticketId,
      appleWalletUrl: data.appleWalletUrl ?? null,
      ticketValidTime,
      ticketValidDate,
      attendeeName,
      isVIP,
      isExternal,
    }));
  }

  // Calendar button
  if (googleCalendarUrl) {
    contentSections.push(buildCalendarButton(googleCalendarUrl));
  }

  const bodyContent = `
    ${cancelBanner}
    ${heroCard}
    <!-- Content -->
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter(essentialFooter(data.eventName))}`;

  return buildEmailShell(
    "Day-of Reminder",
    buildEmailStyles({ isVIP, isExternal }),
    bodyContent,
  );
}

function generateDayOfReminderEmailText(
  data: DayOfReminderEmailData,
): string {
  const {
    eventName,
    ticketType,
    eventStartTime,
    eventRoute,
    ticketId,
    doorsOpenTime,
  } = data;

  const formattedDate = formatFullDateTime(doorsOpenTime || eventStartTime);
  const formattedDoorsOpen = doorsOpenTime ? formatPillTime(doorsOpenTime) : null;
  const formattedClose = eventStartTime ? formatPillTime(eventStartTime) : null;
  const doorsClause = buildDoorsClause(formattedDoorsOpen, formattedClose);

  const baseUrl = getBaseUrl();
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;
  const cancelTicketUrl = data.cancelTicketUrl ?? null;

  const isVIP = ticketType?.toUpperCase() === "VIP";
  const isExternal = ticketType?.toUpperCase() === "EXTERNAL";
  const cancelLine = cancelTicketUrl
    ? `Can't make it? Please cancel so someone else can attend.\nCancel Ticket: ${cancelTicketUrl}`
    : "";

  return `
${!isVIP && !isExternal && cancelLine ? `${cancelLine}\n\n---\n` : ""}${eventName || "Event"} is TODAY${formattedDoorsOpen ? ` - Doors at ${formattedDoorsOpen}` : ""}!

${isVIP ? "Use the VIP entrance when you arrive — we've saved you a front-row seat.\n\n" : ""}See you tonight!${doorsClause ? ` ${doorsClause} — don't be late, no late entry allowed.` : ""}

${buildImportantNoticeText()}
${isVIP || isExternal ? `\n${cancelLine}` : ""}

Event Details:
${data.name ? `- Name: ${data.name}\n` : ""}- Event: ${eventName || "Event"}
- Date & Time: ${formattedDate}
- Ticket Type: ${ticketType || "STANDARD"}
- Ticket ID: ${ticketId}
${eventUrl ? `- Event URL: ${eventUrl}` : ""}

Stanford Speakers Bureau
For ADA accommodations or other questions, please email ${FROM_EMAIL}
  `.trim();
}

export async function sendDayOfReminderEmail(
  data: DayOfReminderEmailData,
): Promise<void> {
  // Check if email sending is disabled
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() == "true") {
    console.log(
      `Email sending is disabled (DISABLE_EMAIL=true). Skipping reminder email to ${data.email}`,
    );
    return;
  }

  const formattedDoorsOpen = data.doorsOpenTime
    ? new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: PACIFIC_TIMEZONE,
    }).format(new Date(data.doorsOpenTime))
    : null;

  const subject = data.eventName
    ? `[${formattedDoorsOpen ? `DOORS @ ${formattedDoorsOpen} ` : ""}TODAY!] Come see ${data.eventName}${data.eventVenue ? ` @ ${data.eventVenue}` : ""}`
    : "Event Reminder - Today!";
  const cancelTicketUrl = await buildCancellationLink({
    baseUrl: getBaseUrl(),
    email: data.email,
    ticketId: data.ticketId,
    eventStartTime: data.eventStartTime,
    eventEndTime: data.eventEndTime ?? null,
  });
  const appleWalletUrl = await buildAppleWalletLink({
    baseUrl: getBaseUrl(),
    email: data.email,
    ticketId: data.ticketId,
    eventStartTime: data.eventStartTime,
    eventEndTime: data.eventEndTime ?? null,
  });
  const renderData: DayOfReminderEmailData = {
    ...data,
    cancelTicketUrl,
    appleWalletUrl,
  };
  const textContent = generateDayOfReminderEmailText(renderData);

  // Generate QR and prepare cid
  const qrCid = `ticket-qr-${data.ticketId}@stanfordspeakersbureau`;
  const qrBuffer = await generateQRCodePngBuffer(data.ticketId);
  const htmlContent = await generateDayOfReminderEmailHTML(renderData, {
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
    ...buildUtf8MimeBodyPart("text/plain", textContent),
  );

  if (qrBuffer) {
    // multipart/related containing HTML and inline image
    const qrBase64 = wrapToMimeLines(qrBuffer.toString("base64"));
    lines.push(
      `--${altBoundary}`,
      `Content-Type: multipart/related; boundary="${relBoundary}"`,
      "",
      `--${relBoundary}`,
      ...buildUtf8MimeBodyPart("text/html", htmlContent),
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
      ...buildUtf8MimeBodyPart("text/html", htmlContent),
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

  await sendRawEmailViaSES(rawMessage, data.email);
  console.log(`Day-of reminder email sent to ${data.email}`);
}

// ============================================================================
// Ticket cancellation email
// ============================================================================

export type CancellationEmailData = {
  email: string;
  name?: string | null;
  eventName: string;
  ticketType: string;
  eventStartTime: string | null;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
  eventRoute?: string | null;
  eventId?: string | null;
  imgVersion?: number | null;
  eventTagline?: string | null;
};

async function generateCancellationEmailHTML(
  data: CancellationEmailData,
): Promise<string> {
  const { eventName, eventStartTime, eventRoute, eventVenue, eventVenueLink } = data;

  const baseUrl = getBaseUrl();
  const isVIP = data.ticketType?.toUpperCase() === "VIP";
  const isExternal = data.ticketType?.toUpperCase() === "EXTERNAL";
  const formattedDate = formatFullDateTime(eventStartTime);
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;

  const heroCard = buildHeroCard({
    eventName,
    eventTagline: data.eventTagline,
    eventStartTime,
    eventVenue,
    eventVenueLink,
    eventId: data.eventId,
    imgVersion: data.imgVersion,
    isVIP,
    isExternal,
  });

  const contentSections: string[] = [];

  const greeting = data.name ? `Hi ${data.name}, your` : "Your";
  contentSections.push(buildParagraph(
    `${greeting} ticket for ${eventName} has been cancelled.`,
  ));

  const detailRows: { label: string; value: string; isLink?: boolean; href?: string }[] = [];
  if (data.name) detailRows.push({ label: "Name:", value: data.name });
  detailRows.push({ label: "Event:", value: eventName });
  detailRows.push({ label: "Date & Time:", value: formattedDate });
  if (eventVenue) {
    detailRows.push({
      label: "Location:",
      value: eventVenue,
      isLink: !!eventVenueLink,
      href: eventVenueLink || undefined,
    });
  }
  contentSections.push(buildDetailsCard({
    rows: detailRows,
    ticketTypeBadge: { type: data.ticketType || "STANDARD" },
    actionButtonHref: eventUrl,
    isVIP,
    isExternal,
  }));

  contentSections.push(buildParagraph(
    `If you did not request this cancellation, please contact us at ${FROM_EMAIL}.`,
    { color: "#a1a1aa", fontSize: "14px" },
  ));

  const bodyContent = `
    ${heroCard}
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter()}`;

  return buildEmailShell(
    "Ticket Cancellation",
    buildEmailStyles({ isVIP, isExternal }),
    bodyContent,
  );
}

function generateCancellationEmailText(data: CancellationEmailData): string {
  const { eventName, eventStartTime, eventRoute, eventVenue } = data;
  const formattedDate = formatFullDateTime(eventStartTime);
  const baseUrl = getBaseUrl();
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;
  const greeting = data.name ? `Hi ${data.name}, your` : "Your";

  return `
Ticket Cancelled

${greeting} ticket for ${eventName} has been cancelled.

Event Details:
${data.name ? `- Name: ${data.name}\n` : ""}- Event: ${eventName}
- Date & Time: ${formattedDate}
${eventVenue ? `- Location: ${eventVenue}\n` : ""}- Ticket Type: ${data.ticketType || "STANDARD"}
${eventUrl ? `- Event Page: ${eventUrl}` : ""}

If you did not request this cancellation, please contact us at ${FROM_EMAIL}.

Stanford Speakers Bureau
For ADA accommodations or other questions, please email ${FROM_EMAIL}
  `.trim();
}

export async function sendCancellationEmail(
  data: CancellationEmailData,
): Promise<void> {
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() === "true") {
    console.log(
      `Email sending is disabled (DISABLE_EMAIL=true). Skipping cancellation email to ${data.email}`,
    );
    return;
  }

  const subject = `Cancellation Confirmed: Your ticket for ${data.eventName}`;
  const textContent = generateCancellationEmailText(data);
  const htmlContent = await generateCancellationEmailHTML(data);

  const boundary = `mix_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const lines: string[] = [];
  lines.push(
    `From: ${FROM_EMAIL}`,
    `To: ${data.email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    ...buildUtf8MimeBodyPart("text/plain", textContent),
    `--${boundary}`,
    ...buildUtf8MimeBodyPart("text/html", htmlContent),
    `--${boundary}--`,
    "",
  );

  const rawMessage = lines.join("\r\n");

  await sendRawEmailViaSES(rawMessage, data.email);
  console.log(`Cancellation email sent to ${data.email}`);
}

// ============================================================================
// Early reminder email
// ============================================================================

type EarlyReminderEmailData = TicketEmailData & {
  doorsOpenTime?: string | null;
  /** Optional promotional message to display at the top of the email */
  promo?: {
    title: string; // e.g. "Want a front row seat?"
    description: string; // e.g. "We're hosting a Hasan Minhaj lookalike contest! It's your ticket to a front row seat at the show!"
    day?: string; // e.g. "This Thursday"
    location?: string; // e.g. "White Plaza"
    time?: string; // e.g. "5 PM"
  } | null;
};

async function generateEarlyReminderEmailHTML(
  data: EarlyReminderEmailData,
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
    doorsOpenTime,
    promo,
  } = data;

  const baseUrl = getBaseUrl();
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;
  const cancelTicketUrl = data.cancelTicketUrl ?? null;
  const isVIP = ticketType?.toUpperCase() === "VIP";
  const isExternal = ticketType?.toUpperCase() === "EXTERNAL";

  const formattedDate = formatFullDateTime(doorsOpenTime || eventStartTime);
  const formattedDoorsOpen = doorsOpenTime ? formatPillTime(doorsOpenTime) : null;
  const formattedClose = eventStartTime ? formatPillTime(eventStartTime) : null;
  const doorsClause = buildDoorsClause(formattedDoorsOpen, formattedClose);

  const dayLabel = formattedDate.includes("Friday") ? "Friday" : formattedDate.split(",")[0];
  const _tomorrowDate = new Date();
  _tomorrowDate.setDate(_tomorrowDate.getDate() + 1);
  const isTomorrow = eventStartTime
    ? new Date(eventStartTime).toLocaleDateString("en-US", { timeZone: PACIFIC_TIMEZONE }) ===
    _tomorrowDate.toLocaleDateString("en-US", { timeZone: PACIFIC_TIMEZONE })
    : false;

  const qrImageSrc = options?.qrCid ? `cid:${options.qrCid}` : "";
  const ticketValidTime = eventStartTime
    ? new Date(eventStartTime).toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: PACIFIC_TIMEZONE,
    })
    : "";
  const ticketValidDate = eventStartTime
    ? new Date(eventStartTime).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: PACIFIC_TIMEZONE,
    })
    : "";
  const attendeeName = data.name?.trim() || "you";

  const googleCalendarUrl = generateGoogleCalendarUrl({
    eventName: data.eventName,
    eventStartTime: data.eventStartTime,
    eventEndTime: data.eventEndTime,
    eventRoute: data.eventRoute,
    eventVenue: data.eventVenue,
    eventDescription: data.eventDescription,
    ticketId: data.ticketId,
    ticketType: data.ticketType,
  });

  // Build detail rows
  const detailRows: { label: string; value: string; isLink?: boolean; href?: string }[] = [];
  if (data.name) detailRows.push({ label: "Name:", value: data.name });
  detailRows.push({ label: "Event:", value: eventName || "Event" });
  detailRows.push({ label: "Date & Time:", value: formattedDate });
  if (eventVenue) {
    detailRows.push({
      label: "Location:",
      value: eventVenue,
      isLink: !!eventVenueLink,
      href: eventVenueLink || undefined,
    });
  }
  detailRows.push({
    label: "Ticket ID:",
    value: `<span style="font-family: monospace; word-break: break-all;">${ticketId}</span>`,
  });

  // Assemble content sections
  const heroCard = buildHeroCard({
    eventName,
    eventTagline: data.eventTagline,
    eventStartTime,
    doorsOpenTime,
    eventVenue,
    eventVenueLink,
    eventId: data.eventId,
    imgVersion: data.imgVersion,
    isVIP,
    isExternal,
  });

  const cancelBanner = !isVIP && !isExternal && cancelTicketUrl
    ? buildCancelBanner(cancelTicketUrl)
    : "";

  const contentSections: string[] = [];

  // Important notice
  contentSections.push(buildImportantNotice(undefined));

  // Promo card (conditional)
  if (promo) {
    let promoContent = buildParagraph(promo.description);
    if (promo.day || promo.location || promo.time) {
      promoContent += `
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          ${promo.day ? `<tr><td style="padding: 4px 0; font-size: 16px; color: #f4f4f5;">&#128197; ${promo.day}</td></tr>` : ""}
          ${promo.location ? `<tr><td style="padding: 4px 0; font-size: 16px; color: #f4f4f5;">&#128205; ${promo.location}</td></tr>` : ""}
          ${promo.time ? `<tr><td style="padding: 4px 0; font-size: 16px; color: #f4f4f5;">&#128340; ${promo.time}</td></tr>` : ""}
        </table>`;
    }
    contentSections.push(promoContent);
  }

  // Excitement message
  contentSections.push(buildParagraph(
    `${promo ? "Not interested? No worries, we're" : "We're"} excited to see you ${isTomorrow ? "tomorrow" : `this ${dayLabel}`}!${doorsClause ? ` ${doorsClause} &mdash; no late entry, so plan to arrive early.` : ""}`,
  ));

  // Cancel ticket message + button (VIP/External only — regular tickets use the top banner)
  if (isVIP || isExternal) {
    contentSections.push(buildParagraph(
      "Can't make it? Please cancel so someone else can attend.",
    ));
    if (cancelTicketUrl) {
      contentSections.push(buildButton(cancelTicketUrl, "Cancel Ticket"));
    }
  }

  // Event details card
  contentSections.push(buildDetailsCard({
    rows: detailRows,
    ticketTypeBadge: { type: ticketType || "STANDARD" },
    actionButtonHref: eventUrl,
    isVIP,
    isExternal,
  }));

  // QR code section
  if (qrImageSrc) {
    contentSections.push(buildQRSection({
      qrImageSrc,
      ticketType: ticketType || "STANDARD",
      ticketId,
      appleWalletUrl: data.appleWalletUrl ?? null,
      ticketValidTime,
      ticketValidDate,
      attendeeName,
      isVIP,
      isExternal,
    }));
  }

  // Calendar button
  if (googleCalendarUrl) {
    contentSections.push(buildCalendarButton(googleCalendarUrl));
  }

  const bodyContent = `
    ${cancelBanner}
    ${heroCard}
    <!-- Content -->
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter(essentialFooter(data.eventName))}`;

  return buildEmailShell(
    "Event Reminder",
    buildEmailStyles({ isVIP, isExternal }),
    bodyContent,
  );
}

function generateEarlyReminderEmailText(
  data: EarlyReminderEmailData,
): string {
  const {
    eventName,
    ticketType,
    eventStartTime,
    eventRoute,
    ticketId,
    doorsOpenTime,
    promo,
  } = data;

  const formattedDate = formatFullDateTime(doorsOpenTime || eventStartTime);
  const formattedDoorsOpen = doorsOpenTime ? formatPillTime(doorsOpenTime) : null;
  const formattedClose = eventStartTime ? formatPillTime(eventStartTime) : null;
  const doorsClause = buildDoorsClause(formattedDoorsOpen, formattedClose);

  const dayLabel = formattedDate.includes("Friday") ? "Friday" : formattedDate.split(",")[0];
  const _tomorrowDate = new Date();
  _tomorrowDate.setDate(_tomorrowDate.getDate() + 1);
  const isTomorrow = eventStartTime
    ? new Date(eventStartTime).toLocaleDateString("en-US", { timeZone: PACIFIC_TIMEZONE }) ===
    _tomorrowDate.toLocaleDateString("en-US", { timeZone: PACIFIC_TIMEZONE })
    : false;
  const dayPhrase = isTomorrow ? "TOMORROW" : `this ${dayLabel}`;

  const baseUrl = getBaseUrl();
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;
  const cancelTicketUrl = data.cancelTicketUrl ?? null;

  // Build promo section if present
  const promoSection = promo
    ? `
${promo.description}
${promo.day ? `\u{1F5D3}\uFE0F ${promo.day}` : ""}
${promo.location ? `\u{1F4CD} ${promo.location}` : ""}
${promo.time ? `\u{1F554} ${promo.time}` : ""}

`
    : "";

  const isVIP = ticketType?.toUpperCase() === "VIP";
  const isExternal = ticketType?.toUpperCase() === "EXTERNAL";
  const cancelLine = cancelTicketUrl
    ? `Can't make it? Please cancel so someone else can attend.\nCancel Ticket: ${cancelTicketUrl}`
    : "";

  return `
${!isVIP && !isExternal && cancelLine ? `${cancelLine}\n\n---\n` : ""}${eventName} is ${dayPhrase}!${promo?.title ? ` ${promo.title}` : ""}
${promoSection}
${promo ? "Not interested? No worries, we're" : "We're"} excited to see you ${isTomorrow ? "tomorrow" : `this ${dayLabel}`}!${doorsClause ? ` ${doorsClause} — no late entry, so plan to arrive early.` : ""}

${buildImportantNoticeText()}
${isVIP || isExternal ? `\n${cancelLine}` : ""}

Event Details:
${data.name ? `- Name: ${data.name}\n` : ""}- Event: ${eventName || "Event"}
- Date & Time: ${formattedDate}
- Ticket Type: ${ticketType || "STANDARD"}
- Ticket ID: ${ticketId}
${eventUrl ? `- Event URL: ${eventUrl}` : ""}

Stanford Speakers Bureau
For ADA accommodations or other questions, please email ${FROM_EMAIL}
  `.trim();
}

export async function sendEarlyReminderEmail(
  data: EarlyReminderEmailData,
): Promise<void> {
  // Check if email sending is disabled
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() == "true") {
    console.log(
      `Email sending is disabled (DISABLE_EMAIL=true). Skipping early reminder email to ${data.email}`,
    );
    return;
  }

  const formattedDoorsOpen = data.doorsOpenTime
    ? new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: PACIFIC_TIMEZONE,
    }).format(new Date(data.doorsOpenTime))
    : null;

  // Format day of week from event start time
  const dayOfWeek = data.eventStartTime
    ? new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "America/Los_Angeles",
    }).format(new Date(data.eventStartTime))
    : "Friday";

  const _tomorrowForSubject = new Date();
  _tomorrowForSubject.setDate(_tomorrowForSubject.getDate() + 1);
  const isEventTomorrow = data.eventStartTime
    ? new Date(data.eventStartTime).toLocaleDateString("en-US", { timeZone: PACIFIC_TIMEZONE }) ===
    _tomorrowForSubject.toLocaleDateString("en-US", { timeZone: PACIFIC_TIMEZONE })
    : false;

  const subject = data.eventName
    ? `Can you still make it ${isEventTomorrow ? "tomorrow" : `this ${dayOfWeek}`}${formattedDoorsOpen ? ` @ ${formattedDoorsOpen}` : ""}? ${data.eventName}${data.eventVenue ? ` @ ${data.eventVenue}` : ""}`
    : "Event Reminder";
  const cancelTicketUrl = await buildCancellationLink({
    baseUrl: getBaseUrl(),
    email: data.email,
    ticketId: data.ticketId,
    eventStartTime: data.eventStartTime,
    eventEndTime: data.eventEndTime ?? null,
  });
  const appleWalletUrl = await buildAppleWalletLink({
    baseUrl: getBaseUrl(),
    email: data.email,
    ticketId: data.ticketId,
    eventStartTime: data.eventStartTime,
    eventEndTime: data.eventEndTime ?? null,
  });
  const renderData: EarlyReminderEmailData = {
    ...data,
    cancelTicketUrl,
    appleWalletUrl,
  };
  const textContent = generateEarlyReminderEmailText(renderData);

  // Generate QR and prepare cid
  const qrCid = `ticket-qr-${data.ticketId}@stanfordspeakersbureau`;
  const qrBuffer = await generateQRCodePngBuffer(data.ticketId);
  const htmlContent = await generateEarlyReminderEmailHTML(renderData, {
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
    ...buildUtf8MimeBodyPart("text/plain", textContent),
  );

  if (qrBuffer) {
    // multipart/related containing HTML and inline image
    const qrBase64 = wrapToMimeLines(qrBuffer.toString("base64"));
    lines.push(
      `--${altBoundary}`,
      `Content-Type: multipart/related; boundary="${relBoundary}"`,
      "",
      `--${relBoundary}`,
      ...buildUtf8MimeBodyPart("text/html", htmlContent),
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
      ...buildUtf8MimeBodyPart("text/html", htmlContent),
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

  await sendRawEmailViaSES(rawMessage, data.email);
  console.log(`Early reminder email sent to ${data.email}`);
}

// ============================================================================
// Notify: tickets available now
// ============================================================================

/** Data for "tickets available now" email to notify list signups */
export type NotifyTicketsAvailableNowData = {
  email: string;
  eventName: string;
  eventRoute: string | null;
  eventStartTime: string | null;
  eventId?: string | null;
  imgVersion?: number | null;
  eventTagline?: string | null;
  doorsOpenTime?: string | null;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
};

function generateTicketsAvailableNowEmailText(
  data: NotifyTicketsAvailableNowData,
): string {
  const baseUrl = getBaseUrl();
  const eventUrl = data.eventRoute ? `${baseUrl}/events/${data.eventRoute}` : baseUrl;
  const formattedDate = formatFullDateTime(data.doorsOpenTime || data.eventStartTime);
  return `
Tickets to ${data.eventName} just dropped!

You asked to be notified — grab your free ticket before they're gone!

Get your ticket now: ${eventUrl}

Event Details:
- Event: ${data.eventName}
- Date & Time: ${formattedDate}

First come, first served.

Stanford Speakers Bureau
For questions, please email ${FROM_EMAIL}
  `.trim();
}

async function generateTicketsAvailableNowEmailHTML(
  data: NotifyTicketsAvailableNowData,
): Promise<string> {
  const baseUrl = getBaseUrl();
  const eventUrl = data.eventRoute ? `${baseUrl}/events/${data.eventRoute}` : baseUrl;
  const formattedDate = formatFullDateTime(data.doorsOpenTime || data.eventStartTime);

  const heroCard = buildHeroCard({
    eventName: data.eventName,
    eventTagline: data.eventTagline,
    eventStartTime: data.eventStartTime,
    doorsOpenTime: data.doorsOpenTime,
    eventVenue: data.eventVenue,
    eventVenueLink: data.eventVenueLink,
    eventId: data.eventId,
    imgVersion: data.imgVersion,
  });

  const contentSections: string[] = [];

  // Main message
  contentSections.push(buildParagraph(
    `Tickets to ${data.eventName} just dropped!`,
    { fontSize: "18px", fontWeight: "600" },
  ));
  contentSections.push(buildParagraph(
    "You asked to be notified &mdash; grab your free ticket before they're gone!",
    { color: "#a1a1aa" },
  ));

  // CTA Button
  contentSections.push(buildButton(eventUrl, "Get Your Ticket", { style: " padding: 16px 40px; font-weight: 700; font-size: 18px; letter-spacing: 0.5px;" }));

  // Partial details card (event + date only)
  contentSections.push(buildDetailsCard({
    rows: [
      { label: "Event:", value: data.eventName },
      { label: "Date & Time:", value: formattedDate },
    ],
  }));

  // First-come first-served note
  contentSections.push(buildParagraph(
    "First come, first served.",
    { color: "#a1a1aa", fontSize: "14px" },
  ));

  const bodyContent = `
    ${heroCard}
    <!-- Content -->
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter(eventUnsubFooter({
    email: data.email,
    eventId: data.eventId,
    eventName: data.eventName,
    eventStartTime: data.eventStartTime,
  }))}`;

  return buildEmailShell(
    "Tickets are LIVE!",
    buildEmailStyles(),
    bodyContent,
  );
}

export async function sendTicketsAvailableNowEmail(
  data: NotifyTicketsAvailableNowData,
  opts?: { skipSuppressionCheck?: boolean },
): Promise<void> {
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() === "true") {
    console.log(`Email disabled. Skipping tickets-available-now to ${data.email}`);
    return;
  }
  const subject = `Tickets are LIVE for ${data.eventName}!`;
  const textContent = generateTicketsAvailableNowEmailText(data);
  const htmlContent = await generateTicketsAvailableNowEmailHTML(data);
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [
    `From: ${FROM_EMAIL}`,
    `To: ${data.email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/plain", textContent),
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/html", htmlContent),
    `--${altBoundary}--`,
    "",
  ];
  await sendRawEmailViaSES(lines.join("\r\n"), data.email, opts?.skipSuppressionCheck);
  console.log(`Tickets available now email sent to ${data.email}`);
}

// ============================================================================
// Notify: tickets available in X
// ============================================================================

/** Data for "tickets available in X" email to notify list signups */
export type NotifyTicketsAvailableInData = {
  email: string;
  eventName: string;
  eventRoute: string | null;
  eventStartTime: string | null;
  /** Human-readable time until tickets available, e.g. "2 hours" or "Monday at 10am PT" */
  approxTimeUntilAvailable: string;
  eventId?: string | null;
  imgVersion?: number | null;
  doorsOpenTime?: string | null;
  eventTagline?: string | null;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
  ticketDropTime?: string | null;
};

function generateTicketsAvailableInEmailText(
  data: NotifyTicketsAvailableInData,
): string {
  const baseUrl = getBaseUrl();
  const eventUrl = data.eventRoute ? `${baseUrl}/events/${data.eventRoute}` : baseUrl;
  const formattedDate = formatFullDateTime(data.doorsOpenTime || data.eventStartTime);
  const ticketDropSection = data.ticketDropTime
    ? `\nTicket Drop: ${formatFullDateTimeWithTimezone(data.ticketDropTime)}\n`
    : "";
  return `
Tickets to ${data.eventName} drop in ${data.approxTimeUntilAvailable}!

You asked to be notified — mark your calendar and be ready!
${ticketDropSection}

Event page: ${eventUrl}

Event Details:
- Event: ${data.eventName}
- Date & Time: ${formattedDate}

First come, first served — set a reminder!

Stanford Speakers Bureau
For questions, please email ${FROM_EMAIL}
  `.trim();
}

async function generateTicketsAvailableInEmailHTML(
  data: NotifyTicketsAvailableInData,
): Promise<string> {
  const baseUrl = getBaseUrl();
  const eventUrl = data.eventRoute ? `${baseUrl}/events/${data.eventRoute}` : baseUrl;
  const formattedDate = formatFullDateTime(data.doorsOpenTime || data.eventStartTime);

  const heroCard = buildHeroCard({
    eventName: data.eventName,
    eventTagline: data.eventTagline,
    eventStartTime: data.eventStartTime,
    doorsOpenTime: data.doorsOpenTime,
    eventVenue: data.eventVenue,
    eventVenueLink: data.eventVenueLink,
    eventId: data.eventId,
    imgVersion: data.imgVersion,
  });

  const contentSections: string[] = [];

  // Main message
  contentSections.push(buildParagraph(
    `Tickets to ${data.eventName} drop in ${data.approxTimeUntilAvailable}!`,
    { fontSize: "18px", fontWeight: "600" },
  ));
  contentSections.push(buildParagraph(
    "You asked to be notified &mdash; mark your calendar and be ready!",
    { color: "#a1a1aa" },
  ));
  if (data.ticketDropTime) {
    contentSections.push(buildDateTimeCallout({
      eyebrow: "Ticket Drop",
      value: formatTicketDropTime(data.ticketDropTime),
      subtitle: "First come, first served. Set a reminder a few minutes early.",
    }));
  }

  // CTA Button
  contentSections.push(buildButton(eventUrl, "View Event Page", { style: " padding: 16px 40px; font-weight: 700; font-size: 18px; letter-spacing: 0.5px;" }));

  // Partial details card (event + date + countdown)
  contentSections.push(buildDetailsCard({
    rows: [
      { label: "Event:", value: data.eventName },
      { label: "Date & Time:", value: formattedDate },
    ],
  }));

  // Set a reminder note
  contentSections.push(buildParagraph(
    "First come, first served &mdash; set a reminder!",
    { color: "#a1a1aa", fontSize: "14px" },
  ));

  const bodyContent = `
    ${heroCard}
    <!-- Content -->
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter(eventUnsubFooter({
    email: data.email,
    eventId: data.eventId,
    eventName: data.eventName,
    eventStartTime: data.eventStartTime,
  }))}`;

  return buildEmailShell(
    "Tickets dropping soon!",
    buildEmailStyles(),
    bodyContent,
  );
}

export async function sendTicketsAvailableInEmail(
  data: NotifyTicketsAvailableInData,
  opts?: { skipSuppressionCheck?: boolean },
): Promise<void> {
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() === "true") {
    console.log(`Email disabled. Skipping tickets-available-in to ${data.email}`);
    return;
  }
  const subject = `Heads up! Tickets for ${data.eventName} drop in ${data.approxTimeUntilAvailable}`;
  const textContent = generateTicketsAvailableInEmailText(data);
  const htmlContent = await generateTicketsAvailableInEmailHTML(data);
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [
    `From: ${FROM_EMAIL}`,
    `To: ${data.email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/plain", textContent),
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/html", htmlContent),
    `--${altBoundary}--`,
    "",
  ];
  await sendRawEmailViaSES(lines.join("\r\n"), data.email, opts?.skipSuppressionCheck);
  console.log(`Tickets available in email sent to ${data.email}`);
}

// ============================================================================
// Claim ticket email
// ============================================================================

/** Data for "claim your ticket" email to notify list signups */
export type ClaimTicketEmailData = {
  email: string;
  eventName: string;
  eventRoute: string | null;
  eventStartTime: string | null;
  eventId?: string | null;
  imgVersion?: number | null;
  eventTagline?: string | null;
  doorsOpenTime?: string | null;
};

function generateClaimTicketEmailText(data: ClaimTicketEmailData): string {
  const baseUrl = getBaseUrl();
  const eventUrl = data.eventRoute ? `${baseUrl}/events/${data.eventRoute}` : baseUrl;
  const formattedDate = formatFullDateTime(data.doorsOpenTime || data.eventStartTime);
  return `
Tickets to ${data.eventName} are live!

We saved one for you — head to the event page to claim it!

Claim your ticket: ${eventUrl}

Event Details:
- Event: ${data.eventName}
- Date & Time: ${formattedDate}

First come, first served — don't wait!

Stanford Speakers Bureau
For questions, please email ${FROM_EMAIL}
  `.trim();
}

async function generateClaimTicketEmailHTML(
  data: ClaimTicketEmailData,
): Promise<string> {
  const baseUrl = getBaseUrl();
  const eventUrl = data.eventRoute ? `${baseUrl}/events/${data.eventRoute}` : baseUrl;
  const formattedDate = formatFullDateTime(data.doorsOpenTime || data.eventStartTime);

  const heroCard = buildHeroCard({
    eventName: data.eventName,
    eventTagline: data.eventTagline,
    eventStartTime: data.eventStartTime,
    eventId: data.eventId,
    imgVersion: data.imgVersion,
  });

  const contentSections: string[] = [];

  // Main message
  contentSections.push(buildParagraph(
    `Tickets to ${data.eventName} are live!`,
    { fontSize: "18px", fontWeight: "600" },
  ));
  contentSections.push(buildParagraph(
    "We saved one for you &mdash; head to the event page to claim it!",
    { color: "#a1a1aa" },
  ));

  // CTA Button
  contentSections.push(buildButton(eventUrl, "Claim Your Ticket", { style: " padding: 16px 40px; font-weight: 700; font-size: 18px; letter-spacing: 0.5px;" }));

  // Partial details card (event + date only)
  contentSections.push(buildDetailsCard({
    rows: [
      { label: "Event:", value: data.eventName },
      { label: "Date & Time:", value: formattedDate },
    ],
  }));

  // First-come first-served note
  contentSections.push(buildParagraph(
    "First come, first served &mdash; don't wait!",
    { color: "#a1a1aa", fontSize: "14px" },
  ));

  const bodyContent = `
    ${heroCard}
    <!-- Content -->
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter(eventUnsubFooter({
    email: data.email,
    eventId: data.eventId,
    eventName: data.eventName,
    eventStartTime: data.eventStartTime,
  }))}`;

  return buildEmailShell(
    "Tickets are LIVE!",
    buildEmailStyles(),
    bodyContent,
  );
}

export async function sendClaimTicketEmail(
  data: ClaimTicketEmailData,
  opts?: { skipSuppressionCheck?: boolean },
): Promise<void> {
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() === "true") {
    console.log(`Email disabled. Skipping claim-ticket to ${data.email}`);
    return;
  }
  const subject = `Tickets are LIVE for ${data.eventName}!`;
  const textContent = generateClaimTicketEmailText(data);
  const htmlContent = await generateClaimTicketEmailHTML(data);
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [
    `From: ${FROM_EMAIL}`,
    `To: ${data.email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/plain", textContent),
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/html", htmlContent),
    `--${altBoundary}--`,
    "",
  ];
  await sendRawEmailViaSES(lines.join("\r\n"), data.email, opts?.skipSuppressionCheck);
  console.log(`Claim ticket email sent to ${data.email}`);
}

// ============================================================================
// Standby line email
// ============================================================================

type StandbyLineEmailData = {
  email: string;
  name?: string | null;
  eventName: string;
  eventStartTime: string | null;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
  eventRoute?: string | null; // event slug, for linking back to the event page
  standbyOpenTime?: string; // e.g., "7:30 PM"
  doorsOpenTime?: string | null;
  expectedCapacity?: string; // e.g., "100-200"
  ticketId?: string; // STANDBY ticket ID, if one was issued
  eventId?: string | null;
  imgVersion?: number | null;
  eventTagline?: string | null;
};

async function generateStandbyLineEmailHTML(
  data: StandbyLineEmailData,
): Promise<string> {
  const {
    name,
    eventName,
    eventStartTime,
    eventVenue,
    eventVenueLink,
    eventRoute,
    standbyOpenTime = "7:30 PM",
    expectedCapacity = "100-200",
    ticketId,
  } = data;

  const formattedDate = formatFullDateTime(data.doorsOpenTime || eventStartTime);
  const baseUrl = getBaseUrl();
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;

  const heroCard = buildHeroCard({
    eventName,
    eventTagline: data.eventTagline,
    eventStartTime,
    eventVenue,
    eventVenueLink,
    eventId: data.eventId,
    imgVersion: data.imgVersion,
  });

  const contentSections: string[] = [];

  // Standby info message
  contentSections.push(buildParagraph(
    `Great news &mdash; you'll likely get into ${eventName} via the standby line!`,
  ));
  contentSections.push(buildParagraph(
    `The standby line opens at ${standbyOpenTime} outside ${eventVenue || "the venue"}, so arrive early to claim your spot. Standby admission is first come, first served &mdash; we'll start admitting from the line closer to the event start time, and we expect to let ${expectedCapacity} people in. Admission is not guaranteed, and no bags are allowed.`,
  ));

  // Details card (name, event, date, location, STANDBY badge, ticket ID)
  const detailRows: { label: string; value: string; isLink?: boolean; href?: string }[] = [];
  if (name) detailRows.push({ label: "Name:", value: name });
  detailRows.push({ label: "Event:", value: eventName });
  detailRows.push({ label: "Date & Time:", value: formattedDate });
  if (eventVenue) {
    detailRows.push({
      label: "Location:",
      value: eventVenue,
      isLink: !!eventVenueLink,
      href: eventVenueLink || undefined,
    });
  }

  contentSections.push(buildDetailsCard({
    rows: detailRows,
    ticketTypeBadge: ticketId ? { type: "STANDBY" } : undefined,
    actionButtonHref: eventUrl,
    actionButtonLabel: "View your ticket page",
  }));

  // No QR code: a standby ticket's QR isn't active until staff open admission
  // at the venue. Let the recipient know where it will appear, linking back to
  // the event page (where the ticket lives) when we have its route.
  if (ticketId) {
    const ticketPageText = eventUrl
      ? `<a href="${eventUrl}" target="_blank" rel="noopener noreferrer" style="color: #A80D0C; text-decoration: none; border-bottom: 1px solid #A80D0C;">your ticket page</a>`
      : "your ticket page";
    contentSections.push(buildParagraph(
      `Your QR code isn't active yet. It will appear on ${ticketPageText} once standby admission opens at the venue &mdash; just wait in the standby area until then.`,
    ));
  }

  const bodyContent = `
    ${heroCard}
    <!-- Content -->
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter(essentialFooter(data.eventName))}`;

  return buildEmailShell(
    "Please come in-person for your ticket!",
    buildEmailStyles(),
    bodyContent,
  );
}

function generateStandbyLineEmailText(data: StandbyLineEmailData): string {
  const {
    name,
    eventName,
    eventStartTime,
    eventVenue,
    eventVenueLink,
    eventRoute,
    standbyOpenTime = "7:30 PM",
    expectedCapacity = "100-200",
    ticketId,
  } = data;

  const formattedDate = formatFullDateTime(data.doorsOpenTime || eventStartTime);
  const baseUrl = getBaseUrl();
  const eventUrl = eventRoute ? `${baseUrl}/events/${eventRoute}` : null;

  return `
Please come in-person for your ticket!

Great news — you'll likely get into ${eventName} via the standby line!

The standby line opens at ${standbyOpenTime} outside ${eventVenue || "the venue"}, so arrive early to claim your spot. Standby admission is first come, first served — we'll start admitting from the line closer to the event start time, and we expect to let ${expectedCapacity} people in. Admission is not guaranteed, and no bags are allowed.

${ticketId ? `Your QR code isn't active yet. It will appear on your ticket page once standby admission opens at the venue — just wait in the standby area until then.${eventUrl ? `\n\nView your ticket page: ${eventUrl}` : ""}\n\n` : ""}Event Details:
${name ? `- Name: ${name}\n` : ""}- Event: ${eventName}
- Date & Time: ${formattedDate}
${eventVenue ? `- Location: ${eventVenue}${eventVenueLink ? ` (${eventVenueLink})` : ""}` : ""}
${eventUrl ? `- Event Page: ${eventUrl}` : ""}
${ticketId ? `- Ticket Type: STANDBY\n- Ticket ID: ${ticketId}` : ""}

Stanford Speakers Bureau
For ADA accommodations or other questions, please email ${FROM_EMAIL}
  `.trim();
}

export async function sendStandbyLineEmail(
  data: StandbyLineEmailData,
): Promise<void> {
  // Check if email sending is disabled
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() == "true") {
    console.log(
      `Email sending is disabled (DISABLE_EMAIL=true). Skipping standby line email to ${data.email}`,
    );
    return;
  }

  const subject = `Please come in-person for your ticket!`;
  const textContent = generateStandbyLineEmailText(data);

  // Standby tickets have no scannable QR until staff open admission at the
  // venue, so this email never embeds one — the QR appears on the ticket page
  // once standby admission opens.
  const htmlContent = await generateStandbyLineEmailHTML(data);

  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const lines: string[] = [];
  lines.push(
    `From: ${FROM_EMAIL}`,
    `To: ${data.email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/plain", textContent),
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/html", htmlContent),
  );

  lines.push(`--${altBoundary}--`, "");

  await sendRawEmailViaSES(lines.join("\r\n"), data.email);
  console.log(`Standby line email sent to ${data.email}`);
}

// ============================================================================
// Event Announced email (sent to users not on notify list)
// ============================================================================

export type EventAnnouncedEmailData = {
  email: string;
  eventName: string;
  eventRoute: string | null;
  eventStartTime: string | null;
  eventId?: string | null;
  imgVersion?: number | null;
  eventTagline?: string | null;
  eventDescription?: string | null;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
  doorsOpenTime?: string | null;
  ticketingOpen?: boolean;
};

/** Strip basic markdown to plain-ish HTML (bold, italic, links, line breaks) */
function markdownToEmailHTML(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #A80D0C; text-decoration: underline;">$1</a>')
    .replace(/\n/g, "<br>");
}

function getEventAnnouncementCtaCopy(ticketingOpen?: boolean): {
  body: string;
  buttonLabel: string;
  textLinkLabel: string;
} {
  if (ticketingOpen) {
    return {
      body: "Tickets are live now — get yours on our event page.",
      buttonLabel: "Get Tickets",
      textLinkLabel: "Get tickets",
    };
  }

  return {
    body: "Be the first to know when tickets drop — sign up for notifications on our event page.",
    buttonLabel: "Get Notified",
    textLinkLabel: "View event",
  };
}

function generateEventAnnouncedEmailText(data: EventAnnouncedEmailData): string {
  const baseUrl = getBaseUrl();
  const eventUrl = data.eventRoute ? `${baseUrl}/events/${data.eventRoute}` : baseUrl;
  const formattedDate = formatFullDateTime(data.doorsOpenTime || data.eventStartTime);
  const ctaCopy = getEventAnnouncementCtaCopy(data.ticketingOpen);
  return `
${data.eventName} is coming to Stanford!

${data.eventDescription || ""}

${ctaCopy.body}

${ctaCopy.textLinkLabel}: ${eventUrl}

Event Details:
- Event: ${data.eventName}
- Date & Time: ${formattedDate}
${data.eventVenue ? `- Venue: ${data.eventVenue}${data.eventVenueLink ? ` (${data.eventVenueLink})` : ""}\n` : ""}
Stanford Speakers Bureau
For questions, please email ${FROM_EMAIL}
  `.trim();
}

async function generateEventAnnouncedEmailHTML(
  data: EventAnnouncedEmailData,
): Promise<string> {
  const baseUrl = getBaseUrl();
  const eventUrl = data.eventRoute ? `${baseUrl}/events/${data.eventRoute}` : baseUrl;
  const formattedDate = formatFullDateTime(data.doorsOpenTime || data.eventStartTime);
  const ctaCopy = getEventAnnouncementCtaCopy(data.ticketingOpen);

  const heroCard = buildHeroCard({
    eventName: data.eventName,
    eventTagline: data.eventTagline,
    eventStartTime: data.eventStartTime,
    doorsOpenTime: data.doorsOpenTime,
    eventVenue: data.eventVenue,
    eventVenueLink: data.eventVenueLink,
    eventId: data.eventId,
    imgVersion: data.imgVersion,
  });

  const contentSections: string[] = [];

  contentSections.push(buildParagraph(
    `${data.eventName} is coming to Stanford!`,
    { fontSize: "18px", fontWeight: "600" },
  ));

  // Event bio / description
  if (data.eventDescription) {
    contentSections.push(`
      <div style="background-color: #18181b; padding: 20px 24px; margin-bottom: 24px; border-radius: 8px;">
        ${gmailBlendStart}
          <div style="color: #d4d4d8; font-size: 15px; line-height: 1.7;">${markdownToEmailHTML(data.eventDescription)}</div>
        ${gmailBlendEnd}
      </div>`);
  }

  contentSections.push(buildParagraph(
    ctaCopy.body.replace("—", "&mdash;"),
    { color: "#a1a1aa" },
  ));

  contentSections.push(buildButton(eventUrl, ctaCopy.buttonLabel, { style: " padding: 16px 40px; font-weight: 700; font-size: 18px; letter-spacing: 0.5px;" }));

  // Details card with venue
  const detailRows: { label: string; value: string; isLink?: boolean; href?: string }[] = [
    { label: "Event:", value: data.eventName },
    { label: "Date & Time:", value: formattedDate },
  ];
  if (data.eventVenue) {
    detailRows.push({
      label: "Venue:",
      value: data.eventVenue,
      isLink: !!data.eventVenueLink,
      href: data.eventVenueLink || undefined,
    });
  }
  contentSections.push(buildDetailsCard({ rows: detailRows }));

  const bodyContent = `
    ${heroCard}
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter(eventUnsubFooter({
    email: data.email,
    eventId: data.eventId,
    eventName: data.eventName,
    eventStartTime: data.eventStartTime,
  }))}`;

  return buildEmailShell(
    "Speaker Announcement",
    buildEmailStyles(),
    bodyContent,
  );
}

export async function sendEventAnnouncedEmail(
  data: EventAnnouncedEmailData,
  opts?: { skipSuppressionCheck?: boolean },
): Promise<void> {
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() === "true") {
    console.log(`Email disabled. Skipping event-announced to ${data.email}`);
    return;
  }
  const subject = `${data.eventName} is coming to Stanford!`;
  const textContent = generateEventAnnouncedEmailText(data);
  const htmlContent = await generateEventAnnouncedEmailHTML(data);
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [
    `From: ${FROM_EMAIL}`,
    `To: ${data.email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/plain", textContent),
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/html", htmlContent),
    `--${altBoundary}--`,
    "",
  ];
  await sendRawEmailViaSES(lines.join("\r\n"), data.email, opts?.skipSuppressionCheck);
  console.log(`Event announced email sent to ${data.email}`);
}

// ============================================================================
// Campaign email
// ============================================================================

export type CampaignFooterType =
  | "event_unsubscribe"
  | "announce_unsubscribe"
  | "newsletter_unsubscribe"
  | "essential"
  | "none";

export type CampaignEmailData = {
  email: string;
  subject: string;
  bodyMarkdown: string;
  includeHeroCard: boolean;
  footerType: CampaignFooterType;
  eventName?: string | null;
  eventTagline?: string | null;
  eventStartTime?: string | null;
  doorsOpenTime?: string | null;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
  eventId?: string | null;
  imgVersion?: number | null;
  feedbackPrompt?: {
    eventName: string;
    formUrl: string;
    scoreLinks: Array<{ score: number; url: string }>;
  } | null;
  cancelCallout?: {
    url: string;
    position: "before" | "after";
    text?: string | null;
  } | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCampaignFeedbackPromptHTML(
  prompt: NonNullable<CampaignEmailData["feedbackPrompt"]>,
): string {
  const safeFormUrl = escapeHtml(prompt.formUrl);
  const rows = [prompt.scoreLinks.slice(0, 5), prompt.scoreLinks.slice(5, 10)];

  return `
    <div style="margin-top: 28px; border: 1px solid #3f3f46; border-radius: 20px; background: #18181b; padding: 24px 20px;">
      <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 22px; line-height: 1.3; font-family: Georgia, serif;">
        How likely are you to recommend Stanford Speakers Bureau events to a friend?
      </h3>
      <p style="margin: 0 0 20px 0; color: #d4d4d8; font-size: 14px; line-height: 1.6;">
       It takes just one click to share your feedback!
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 8px 8px; margin: 0 0 10px 0;">
        ${rows.map((row) => `
          <tr>
            ${row.map((entry) => `
              <td width="20%" align="center">
                <a
                  href="${escapeHtml(entry.url)}"
                  style="display: block; padding: 14px 0; border-radius: 10px; background-color: #A80D0C; border: 1px solid #8a0a09; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; box-shadow: 0 1px 0 rgba(0,0,0,0.25);"
                >
                  ${entry.score}
                </a>
              </td>
            `).join("")}
          </tr>
        `).join("")}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 16px 0;">
        <tr>
          <td align="left" style="color: #a1a1aa; font-size: 12px;">Not likely</td>
          <td align="right" style="color: #a1a1aa; font-size: 12px;">Extremely likely</td>
        </tr>
      </table>
      <p style="margin: 0; color: #71717a; font-size: 12px; line-height: 1.5;">
        Prefer a regular link instead?
        <a href="${safeFormUrl}" style="color: #f4f4f5; text-decoration: underline;">Open the feedback form</a>.
      </p>
    </div>
  `;
}

/**
 * Builds the campaign "please cancel" callout — the same prompt and signed
 * cancel link as transactional emails, rendered as a div so it can sit inside
 * the campaign content column before or after the body.
 */
function buildCampaignCancelCallout(
  callout: NonNullable<CampaignEmailData["cancelCallout"]>,
): string {
  const margin =
    callout.position === "before" ? "0 0 24px 0" : "24px 0 0 0";
  const { prefix, label, suffix } = parseCancelCalloutText(callout.text);
  const link = `<a href="${escapeHtml(callout.url)}" style="color: #A80D0C; text-decoration: underline; font-weight: 700;">${escapeHtml(label)}</a>`;
  return `
    <div style="margin: ${margin}; background-color: #18181b; border: 2px solid #A80D0C; border-radius: 8px; padding: 14px 20px; text-align: center;">
      <p style="margin: 0; color: #d4d4d8; font-size: 14px; font-weight: 600; line-height: 1.5;">${escapeHtml(prefix)}${link}${escapeHtml(suffix)}</p>
    </div>`;
}

function generateCampaignEmailText(data: CampaignEmailData): string {
  const body = data.bodyMarkdown
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/<u>(.+?)<\/u>/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  let cancelLine = "";
  if (data.cancelCallout) {
    const { prefix, label, suffix } = parseCancelCalloutText(
      data.cancelCallout.text,
    );
    cancelLine = `${prefix}${label}${suffix}\nCancel: ${data.cancelCallout.url}`;
  }
  const cancelBefore =
    cancelLine && data.cancelCallout?.position === "before"
      ? `${cancelLine}\n\n`
      : "";
  const cancelAfter =
    cancelLine && data.cancelCallout?.position === "after"
      ? `\n\n${cancelLine}`
      : "";

  const feedbackSection = data.feedbackPrompt
    ? `\n\nHow likely are you to recommend Stanford Speakers Bureau events to a friend?\nShare feedback here: ${data.feedbackPrompt.formUrl}`
    : "";

  return `
${cancelBefore}${body}${cancelAfter}
${feedbackSection}

Stanford Speakers Bureau
For questions, please email ${FROM_EMAIL}
  `.trim();
}

function generateCampaignEmailHTML(data: CampaignEmailData): string {
  const contentSections: string[] = [];

  if (data.cancelCallout && data.cancelCallout.position === "before") {
    contentSections.push(buildCampaignCancelCallout(data.cancelCallout));
  }

  contentSections.push(`
    <div style="color: #d4d4d8; font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
      ${gmailBlendStart}
        <div style="color: #f4f4f5; font-size: 16px; line-height: 1.7;">${markdownToEmailHTML(data.bodyMarkdown)}</div>
      ${gmailBlendEnd}
    </div>`);

  if (data.cancelCallout && data.cancelCallout.position === "after") {
    contentSections.push(buildCampaignCancelCallout(data.cancelCallout));
  }

  if (data.feedbackPrompt) {
    contentSections.push(buildCampaignFeedbackPromptHTML(data.feedbackPrompt));
  }

  let heroCard = "";
  if (data.includeHeroCard && data.eventName) {
    heroCard = buildHeroCard({
      eventName: data.eventName,
      eventTagline: data.eventTagline,
      eventStartTime: data.eventStartTime,
      doorsOpenTime: data.doorsOpenTime,
      eventVenue: data.eventVenue,
      eventVenueLink: data.eventVenueLink,
      eventId: data.eventId,
      imgVersion: data.imgVersion,
    });
  }

  let footerCtx: FooterContext | null = null;
  if (data.footerType === "event_unsubscribe" && data.eventId) {
    footerCtx = eventUnsubFooter({
      email: data.email,
      eventId: data.eventId,
      eventName: data.eventName,
      eventStartTime: data.eventStartTime,
    });
  } else if (data.footerType === "announce_unsubscribe") {
    footerCtx = announceUnsubFooter({ email: data.email });
  } else if (data.footerType === "newsletter_unsubscribe") {
    footerCtx = newsletterUnsubFooter({ email: data.email });
  } else if (data.footerType === "essential") {
    footerCtx = essentialFooter(data.eventName);
  }
  // "none" → footerCtx stays null

  const bodyContent = `
    ${heroCard}
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter(footerCtx)}`;

  return buildEmailShell(
    data.subject,
    buildEmailStyles(),
    bodyContent,
  );
}

export async function sendCampaignEmail(
  data: CampaignEmailData,
): Promise<void> {
  if (!isValidEmail(data.email) || hasUnsafeHeaderChars(data.email)) {
    throw new Error("Invalid campaign email recipient");
  }
  if (hasUnsafeHeaderChars(data.subject)) {
    throw new Error("Invalid campaign email subject");
  }

  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() === "true") {
    console.log(`Email disabled. Skipping campaign email to ${data.email}`);
    return;
  }

  const textContent = generateCampaignEmailText(data);
  const htmlContent = generateCampaignEmailHTML(data);
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [
    `From: ${FROM_EMAIL}`,
    `To: ${data.email}`,
    `Subject: ${data.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/plain", textContent),
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/html", htmlContent),
    `--${altBoundary}--`,
    "",
  ];
  await sendRawEmailViaSES(lines.join("\r\n"), data.email);
}

// ============================================================================
// Suggestion approved email
// ============================================================================

/** Data for the "your suggestion is on the leaderboard" email */
export type SuggestionApprovedEmailData = {
  email: string;
  speaker: string;
  suggestionId: string;
};

function generateSuggestionApprovedEmailText(
  data: SuggestionApprovedEmailData,
): string {
  const baseUrl = getBaseUrl();
  const shareUrl = `${baseUrl}/suggest/${data.suggestionId}`;
  const shareCtaUrl = `${shareUrl}?share=1`;
  const leaderboardUrl = `${baseUrl}/suggest`;
  return `
Your suggestion just made the leaderboard.

Nice pick — ${data.speaker} is now live on the Stanford Speakers Bureau community leaderboard.

The names with the most community support become the leads we chase. Help ${data.speaker} climb by sharing this link with friends:

${shareCtaUrl}

Anyone with a Stanford account can tap "Vote" — every upvote moves them closer to a real invite from us.

See the full leaderboard: ${leaderboardUrl}

Stanford Speakers Bureau
Questions? ${FROM_EMAIL}
  `.trim();
}

function generateSuggestionApprovedEmailHTML(
  data: SuggestionApprovedEmailData,
): string {
  const baseUrl = getBaseUrl();
  const shareUrl = `${baseUrl}/suggest/${data.suggestionId}`;
  const shareCtaUrl = `${shareUrl}?share=1`;
  const leaderboardUrl = `${baseUrl}/suggest`;
  const escapedSpeaker = escapeHtml(data.speaker);

  const heroSection = `
    <tr>
      <td align="center" style="padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #A80D0C 0%, #C11211 100%); padding: 32px 24px; text-align: center;">
            ${gmailBlendStart}
              <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85;">Stanford Speakers Bureau</p>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; font-family: Georgia, 'Times New Roman', Times, serif; line-height: 1.2;">${escapedSpeaker} is on the leaderboard.</h1>
            ${gmailBlendEnd}
          </div>
        </div>
      </td>
    </tr>`;

  const contentSections: string[] = [];

  contentSections.push(buildParagraph(
    `Nice pick. <strong style="color: #ffffff;">${escapedSpeaker}</strong> is now live on the Stanford Speakers Bureau community leaderboard.`,
    { fontSize: "17px" },
  ));

  contentSections.push(buildParagraph(
    "The names with the most community support become the leads we actually chase. Help them climb by sharing this link with friends &mdash; every upvote from a Stanford account moves them closer to a real invite.",
    { color: "#a1a1aa" },
  ));

  contentSections.push(buildButton(shareCtaUrl, "Share & Rally Votes", {
    style: " padding: 16px 40px; font-weight: 700; font-size: 16px; letter-spacing: 0.5px;",
  }));

  contentSections.push(`
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td class="details-card" style="background-color: #18181b; border-radius: 12px; padding: 18px 20px;">
          ${gmailBlendStart}
            <p style="margin: 0 0 6px 0; color: #71717a; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Your shareable link</p>
            <p style="margin: 0; color: #f4f4f5; font-size: 14px; font-family: 'SF Mono', Menlo, Consolas, monospace; word-break: break-all; line-height: 1.5;">${shareUrl}</p>
          ${gmailBlendEnd}
        </td>
      </tr>
    </table>`);

  contentSections.push(buildParagraph(
    `Or send the leaderboard so friends can browse and vote on everyone: <a href="${leaderboardUrl}" style="color: #A80D0C; text-decoration: underline;">${leaderboardUrl}</a>`,
    { color: "#a1a1aa", fontSize: "14px" },
  ));

  const bodyContent = `
    ${heroSection}
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter()}`;

  return buildEmailShell(
    "Your suggestion is on the leaderboard",
    buildEmailStyles(),
    bodyContent,
  );
}

export async function sendSuggestionApprovedEmail(
  data: SuggestionApprovedEmailData,
): Promise<void> {
  if (!isValidEmail(data.email) || hasUnsafeHeaderChars(data.email)) {
    console.error(
      `Skipping suggestion approval email — invalid recipient: ${data.email}`,
    );
    return;
  }

  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() === "true") {
    console.log(
      `Email disabled. Skipping suggestion approval email to ${data.email}`,
    );
    return;
  }

  if (await isEmailSuppressed(data.email)) {
    console.log(
      `Email suppression on for ${data.email} — skipping suggestion approval email`,
    );
    return;
  }

  const subject = `${data.speaker} just made the SSB leaderboard`;
  const textContent = generateSuggestionApprovedEmailText(data);
  const htmlContent = generateSuggestionApprovedEmailHTML(data);
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [
    `From: ${FROM_EMAIL}`,
    `To: ${data.email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/plain", textContent),
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/html", htmlContent),
    `--${altBoundary}--`,
    "",
  ];
  await sendRawEmailViaSES(lines.join("\r\n"), data.email);
  console.log(`Suggestion approved email sent to ${data.email}`);
}

export type EventQuestionApprovedEmailData = {
  email: string;
  question: string;
  eventName: string;
  eventRoute: string;
};

function generateEventQuestionApprovedEmailText(
  data: EventQuestionApprovedEmailData,
): string {
  const baseUrl = getBaseUrl();
  const leaderboardUrl = `${baseUrl}/events/${data.eventRoute}/questions`;
  return `
Your question for ${data.eventName} just went live.

"${data.question}"

It's now on the moderator Q&A leaderboard for ${data.eventName}. The moderator picks top-voted questions to ask the speaker — so the more votes, the better the chance.

See all questions and rally votes: ${leaderboardUrl}

Stanford Speakers Bureau
Questions? ${FROM_EMAIL}
  `.trim();
}

function generateEventQuestionApprovedEmailHTML(
  data: EventQuestionApprovedEmailData,
): string {
  const baseUrl = getBaseUrl();
  const leaderboardUrl = `${baseUrl}/events/${data.eventRoute}/questions`;
  const escapedQuestion = escapeHtml(data.question);
  const escapedEventName = escapeHtml(data.eventName);

  const heroSection = `
    <tr>
      <td align="center" style="padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #A80D0C 0%, #C11211 100%); padding: 32px 24px; text-align: center;">
            ${gmailBlendStart}
              <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85;">Moderator Q&amp;A · ${escapedEventName}</p>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; font-family: Georgia, 'Times New Roman', Times, serif; line-height: 1.2;">Your question is live.</h1>
            ${gmailBlendEnd}
          </div>
        </div>
      </td>
    </tr>`;

  const contentSections: string[] = [];

  contentSections.push(`
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td class="details-card" style="background-color: #18181b; border-left: 4px solid #A80D0C; border-radius: 8px; padding: 18px 22px;">
          ${gmailBlendStart}
            <p style="margin: 0; color: #f4f4f5; font-size: 18px; font-style: italic; font-family: Georgia, 'Times New Roman', Times, serif; line-height: 1.45;">&ldquo;${escapedQuestion}&rdquo;</p>
          ${gmailBlendEnd}
        </td>
      </tr>
    </table>`);

  contentSections.push(buildParagraph(
    `It&rsquo;s now on the moderator Q&amp;A leaderboard for <strong style="color: #ffffff;">${escapedEventName}</strong>. The moderator picks top-voted questions to ask the speaker &mdash; the more votes, the better the chance.`,
    { color: "#a1a1aa" },
  ));

  contentSections.push(buildButton(leaderboardUrl, "See the leaderboard", {
    style: " padding: 16px 40px; font-weight: 700; font-size: 16px; letter-spacing: 0.5px;",
  }));

  const bodyContent = `
    ${heroSection}
    <tr>
      <td align="center" class="email-container" style="background-color: #27272a; padding: 32px 20px; max-width: 900px; width: 100%;">
        <div style="padding: 0; max-width: 600px; margin: 0 auto;">
          ${contentSections.join("\n")}
        </div>
      </td>
    </tr>
    ${buildFooter()}`;

  return buildEmailShell(
    "Your question is live",
    buildEmailStyles(),
    bodyContent,
  );
}

export async function sendEventQuestionApprovedEmail(
  data: EventQuestionApprovedEmailData,
): Promise<void> {
  if (!isValidEmail(data.email) || hasUnsafeHeaderChars(data.email)) {
    console.error(
      `Skipping event question approval email — invalid recipient: ${data.email}`,
    );
    return;
  }

  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() === "true") {
    console.log(
      `Email disabled. Skipping event question approval email to ${data.email}`,
    );
    return;
  }

  if (await isEmailSuppressed(data.email)) {
    console.log(
      `Email suppression on for ${data.email} — skipping event question approval email`,
    );
    return;
  }

  const subject = `Your question for ${data.eventName} just went live`;
  const textContent = generateEventQuestionApprovedEmailText(data);
  const htmlContent = generateEventQuestionApprovedEmailHTML(data);
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [
    `From: ${FROM_EMAIL}`,
    `To: ${data.email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/plain", textContent),
    `--${altBoundary}`,
    ...buildUtf8MimeBodyPart("text/html", htmlContent),
    `--${altBoundary}--`,
    "",
  ];
  await sendRawEmailViaSES(lines.join("\r\n"), data.email);
  console.log(`Event question approved email sent to ${data.email}`);
}
