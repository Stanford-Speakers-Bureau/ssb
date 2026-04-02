import type { QRCodeToBufferOptions } from "qrcode";
import QRCode from "qrcode";
import {
  CALENDAR_DEFAULT_DURATION_MS,
  IMPORTANT_NOTICE_ITEMS,
  PACIFIC_TIMEZONE,
  REFERRAL_MESSAGE,
} from "./constants";
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
}

// Toggle to enable/disable referral info in ticket emails
const REFERRAL_ENABLED = false;

const FROM_EMAIL =
  process.env.SES_FROM_EMAIL || "tickets@stanfordspeakersbureau.com";

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
      background-color: #A80D0C !important;
      background-image: linear-gradient(#A80D0C, #A80D0D) !important;
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
  const imageUrl = data.eventId
    ? `${baseUrl}/api/images/${data.eventId}?v=${data.imgVersion || 1}`
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
          <!-- No image fallback: SSB logo header -->
          <div style="background: linear-gradient(135deg, #A80D0C 0%, #C11211 100%); padding: 40px 24px; text-align: center;">
            <img src="${baseUrl}/logo.png" alt="Stanford Speakers Bureau" width="50" height="50" style="display: block; margin: 0 auto 12px;" />
            ${gmailBlendStart}
              <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">Stanford Speakers Bureau</p>
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
              <p style="margin: 0 0 4px 0; color: #a1a1aa; font-size: 15px; line-height: 1.5;">${data.eventTagline}</p>
            ${gmailBlendEnd}
            ` : ""}
            ${pills}
          </div>
        </div>
      </td>
    </tr>`;
}

/** Builds the info pills row (date, doors open, doors close, location) */
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

  if (data.eventStartTime) {
    pills.push(`
      <td style="padding: 0 6px 6px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td class="pill" style="background-color: #2a2a2e; border: 1px solid #3f3f46; border-radius: 50px; padding: 5px 12px; font-size: 13px; color: #e4e4e7; font-weight: 500; white-space: nowrap;">
            <span style="color: #f87171; font-size: 13px; vertical-align: middle;">&#128336;</span>&nbsp;Doors close ${formatPillTime(data.eventStartTime)}
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
  eventPageUrl?: string | null,
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

  const termsLine = eventPageUrl
    ? `<div style="margin: -8px 0 0 0; color: #f4f4f5; font-size: 14px; line-height: 1.6;">
        <a href="${eventPageUrl}" style="color: #fbbf24; text-decoration: underline;">See full event details &rarr;</a>
      </div>`
    : "";

  return `
    <div class="important-box" style="background-color: #A80D0C; padding: 20px 24px; margin-bottom: 24px; border-radius: 8px; text-align: center;">
      ${gmailBlendStart}
        <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 18px; font-weight: 700; text-transform: uppercase;"><b>Before You Arrive</b></h2>
        <div style="color: #ffffff; font-size: 15px; line-height: 1.8;">
          ${itemsHTML}
        </div>
      ${gmailBlendEnd}
    </div>${termsLine}`;
}

/** Generates plain text "Important" notice */
function buildImportantNoticeText(eventPageUrl?: string | null): string {
  const base = `BEFORE YOU ARRIVE:\n${IMPORTANT_NOTICE_ITEMS.map((item) => `- ${item.text}`).join("\n")}`;
  if (eventPageUrl) {
    return `${base}\n\nSee full event details: ${eventPageUrl}`;
  }
  return base;
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
      <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="margin-top: 16px;">
        <tr>
          <td align="center">
            <a href="${baseUrl}/api/tickets/apple-wallet?ticket_id=${opts.ticketId}" target="_blank" rel="noopener noreferrer">
              <img src="${baseUrl}/images/add-to-apple-wallet.png" alt="Add to Apple Wallet" width="auto" height="48" style="display: inline-block; height: 48px; border: 0;" />
            </a>
          </td>
        </tr>
      </table>
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

/** Builds the email footer */
function buildFooter(): string {
  return `
    <tr>
      <td align="center" class="footer" style="padding: 30px; background-color: #18181b; border-top: 1px solid #3f3f46; text-align: center;">
        ${gmailBlendStart}
          <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px;">Stanford Speakers Bureau</p>
          <p style="margin: 0; color: #71717a; font-size: 12px;">
            For ADA accommodations or other questions, please email <a href="mailto:${FROM_EMAIL}" style="color: #a1a1aa; text-decoration: none;">${FROM_EMAIL}</a>
          </p>
        ${gmailBlendEnd}
      </td>
    </tr>`;
}

/** Builds a text paragraph inside the content area */
function buildParagraph(text: string, opts?: { color?: string; fontSize?: string; fontWeight?: string; marginBottom?: string }): string {
  const color = opts?.color || "#f4f4f5";
  const fontSize = opts?.fontSize || "16px";
  const fontWeight = opts?.fontWeight || "normal";
  const marginBottom = opts?.marginBottom || "24px";
  return `${gmailBlendStart}<p style="margin: 0 0 ${marginBottom} 0; color: ${color}; font-size: ${fontSize}; font-weight: ${fontWeight}; line-height: 1.6;">${text}</p>${gmailBlendEnd}`;
}

// ============================================================================
// iCalendar generation (unchanged)
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
// QR Code generation (unchanged)
// ============================================================================

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
  const cancelTicketUrl = ticketId ? `${baseUrl}/cancel/${ticketId}` : null;
  const isVIP = ticketType?.toUpperCase() === "VIP";
  const isExternal = ticketType?.toUpperCase() === "EXTERNAL";

  const formattedDate = formatFullDateTime(eventStartTime);
  const formattedDoorsOpen = doorsOpenTime ? formatPillTime(doorsOpenTime) : null;

  const referralCode = generateReferralCode(data.email);
  const referralUrl =
    referralCode && data.eventRoute
      ? `${baseUrl}/events/${data.eventRoute}?referral_code=${referralCode}`
      : null;

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

  if (REFERRAL_ENABLED && referralCode && !isVIP && !isExternal) {
    detailRows.push({ label: "Referral Code:", value: `<span style="font-family: monospace;">${referralCode}</span>` });
    if (referralUrl) {
      detailRows.push({ label: "Referral Link:", value: referralUrl, isLink: true, href: referralUrl });
    }
  }

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

  const contentSections: string[] = [];

  // Important notice
  contentSections.push(buildImportantNotice(undefined, eventUrl));

  // VIP welcome
  if (isVIP) {
    contentSections.push(buildParagraph(
      "Use the VIP entrance when you arrive &mdash; we've saved you a front-row seat.",
    ));
  }

  // Welcome message
  contentSections.push(buildParagraph("Your ticket is confirmed &mdash; we can't wait to see you!"));

  // Cancel ticket message + button
  contentSections.push(buildParagraph(
    "Can't make it? Please cancel so someone else can attend.",
  ));
  if (cancelTicketUrl) {
    contentSections.push(buildButton(cancelTicketUrl, "Cancel Ticket"));
  }

  // Event details card
  contentSections.push(buildDetailsCard({
    rows: detailRows,
    ticketTypeBadge: { type: ticketType || "STANDARD" },
    actionButtonHref: eventUrl,
    isVIP,
    isExternal,
  }));

  // Referral message
  if (REFERRAL_ENABLED && referralCode && !isVIP && !isExternal) {
    contentSections.push(`
      <div style="margin-bottom: 24px; padding: 16px; text-align: center; border-top: 1px solid #3f3f46;">
        ${gmailBlendStart}
          <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 700; line-height: 1.6;">${REFERRAL_MESSAGE}</p>
          <p style="margin: 8px 0 0 0; color: #71717a; font-size: 12px; line-height: 1.4;">Note: all referrals must be checked in to earn your front row seat!</p>
        ${gmailBlendEnd}
      </div>`);
  }

  // QR code section
  if (qrImageSrc) {
    contentSections.push(buildQRSection({
      qrImageSrc,
      ticketType: ticketType || "STANDARD",
      ticketId,
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
  const cancelTicketUrl = ticketId ? `${baseUrl}/cancel/${ticketId}` : null;
  const referralCode = generateReferralCode(data.email);
  const referralUrl =
    referralCode && data.eventRoute
      ? `${baseUrl}/events/${data.eventRoute}?referral_code=${referralCode}`
      : null;

  return `
${ticketType?.toUpperCase() === "VIP" ? "VIP Ticket Confirmed!" : ticketType?.toUpperCase() === "EXTERNAL" ? "External Ticket Confirmed!" : "Ticket Confirmed!"}

Your ticket is confirmed — we can't wait to see you!

${ticketType?.toUpperCase() === "VIP" ? "Use the VIP entrance when you arrive — we've saved you a front-row seat.\n\n" : ""}Event Details:
${data.name ? `- Name: ${data.name}\n` : ""}- Event: ${eventName || "Event"}
- Date & Time: ${formattedDate}
${formattedDoorsOpen ? `- Doors Open: ${formattedDoorsOpen}\n` : ""}- Ticket Type: ${ticketType || "STANDARD"}
- Ticket ID: ${ticketId}
${eventUrl ? `- Event URL: ${eventUrl}` : ""}

${buildImportantNoticeText(eventUrl)}

Can't make it? Please cancel so someone else can attend.

${cancelTicketUrl ? `Cancel Ticket: ${cancelTicketUrl}` : ""}
${REFERRAL_ENABLED && referralCode && !(ticketType.toUpperCase() == "VIP") && !(ticketType.toUpperCase() == "EXTERNAL") ? `
- Your Referral Code: ${referralCode}
${referralUrl ? `- Your Referral Link: ${referralUrl}` : ""}
${REFERRAL_MESSAGE}
` : ""}

Stanford Speakers Bureau
For ADA accommodations or other questions, please email ${FROM_EMAIL}
  `.trim();
}

export async function sendTicketEmail(data: TicketEmailData): Promise<void> {
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

  await sendRawEmailViaSES(rawMessage);
  console.log(`Ticket confirmation email sent to ${data.email}`);
}

// ============================================================================
// Waitlist confirmation email
// ============================================================================

type WaitlistEmailData = {
  email: string;
  eventName: string;
  position: number;
  eventStartTime: string | null;
  eventVenue?: string | null;
  eventVenueLink?: string | null;
  eventDescription?: string | null;
  eventId?: string | null;
  imgVersion?: number | null;
  eventTagline?: string | null;
};

async function generateWaitlistEmailHTML(
  data: WaitlistEmailData,
): Promise<string> {
  const { eventName, position, eventStartTime, eventVenue, eventVenueLink } = data;

  const formattedDate = formatFullDateTime(eventStartTime);

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

  // Welcome message
  contentSections.push(buildParagraph(
    `You're on the waitlist for ${eventName}. We'll let you know if a spot opens up!`,
  ));

  // Waitlist position badge
  contentSections.push(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div class="position-badge" style="display: inline-block; padding: 20px 40px; background-color: #A80D0C; border-radius: 12px;">
        ${gmailBlendStart}
          <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Position</p>
          <p style="margin: 0; color: #ffffff; font-size: 48px; font-weight: 700;">#${position}</p>
        ${gmailBlendEnd}
      </div>
    </div>`);

  // Event details card (partial)
  const detailRows: { label: string; value: string; isLink?: boolean; href?: string }[] = [
    { label: "Event:", value: eventName },
    { label: "Date & Time:", value: formattedDate },
  ];
  if (eventVenue) {
    detailRows.push({
      label: "Location:",
      value: eventVenue,
      isLink: !!eventVenueLink,
      href: eventVenueLink || undefined,
    });
  }
  contentSections.push(buildDetailsCard({ rows: detailRows }));

  // Standby line notice
  contentSections.push(buildParagraph(
    "Heads up: If a standby line opens at the venue, the online waitlist closes. Come to the venue for a chance to get in!",
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
    "Waitlist Confirmation",
    buildEmailStyles(),
    bodyContent,
  );
}

function generateWaitlistEmailText(data: WaitlistEmailData): string {
  const { eventName, position, eventStartTime, eventVenue } = data;
  const formattedDate = formatFullDateTime(eventStartTime);

  return `
You're on the waitlist!

You're on the waitlist for ${eventName}. We'll let you know if a spot opens up!

Your Position: #${position}

Event Details:
- Event: ${eventName}
- Date & Time: ${formattedDate}
${eventVenue ? `- Location: ${eventVenue}` : ""}

Heads up: If a standby line opens at the venue, the online waitlist closes. Come to the venue for a chance to get in!

Stanford Speakers Bureau
For ADA accommodations or other questions, please email ${FROM_EMAIL}
  `.trim();
}

export async function sendWaitlistEmail(
  data: WaitlistEmailData,
): Promise<void> {
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() == "true") {
    console.log(
      `Email sending is disabled (DISABLE_EMAIL=true). Skipping waitlist email to ${data.email}`,
    );
    return;
  }

  const subject = `You're on the waitlist for ${data.eventName}`;
  const textContent = generateWaitlistEmailText(data);
  const htmlContent = await generateWaitlistEmailHTML(data);

  // Build MIME message
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

  await sendRawEmailViaSES(rawMessage);
  console.log(`Waitlist confirmation email sent to ${data.email}`);
}

// ============================================================================
// VIP scan notification email (internal, not redesigned)
// ============================================================================

type VIPScanNotificationData = {
  attendeeEmail: string;
  attendeeName: string | null;
  eventName: string;
  ticketId: string;
  scanTime: string;
  scannerName: string | null;
  scannerEmail: string | null;
};

function generateVIPScanNotificationHTML(
  data: VIPScanNotificationData,
): string {
  const {
    attendeeEmail,
    attendeeName,
    eventName,
    ticketId,
    scanTime,
    scannerName,
    scannerEmail,
  } = data;

  const formattedScanTime = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: PACIFIC_TIMEZONE,
  }).format(new Date(scanTime));

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VIP Ticket Scanned</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #A80D0C;
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border: 1px solid #ddd;
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    .info-row {
      margin: 10px 0;
    }
    .label {
      font-weight: 600;
      color: #666;
    }
    .value {
      color: #333;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0;">VIP Ticket Scanned</h2>
  </div>
  <div class="content">
    ${attendeeName ? `
    <div class="info-row">
      <span class="label">Attendee Name:</span>
      <span class="value">${attendeeName}</span>
    </div>
    ` : ""}

    <div class="info-row">
      <span class="label">Attendee Email:</span>
      <span class="value">${attendeeEmail}</span>
    </div>

    ${scannerName ? `
    <div class="info-row">
      <span class="label">Scanned By:</span>
      <span class="value">${scannerName}${scannerEmail ? ` (${scannerEmail})` : ""}</span>
    </div>
    ` : scannerEmail ? `
    <div class="info-row">
      <span class="label">Scanned By:</span>
      <span class="value">${scannerEmail}</span>
    </div>
    ` : ""}

    <div class="info-row">
      <span class="label">Event:</span>
      <span class="value">${eventName}</span>
    </div>

    <div class="info-row">
      <span class="label">Ticket ID:</span>
      <span class="value">${ticketId}</span>
    </div>

    <div class="info-row">
      <span class="label">Scan Time:</span>
      <span class="value">${formattedScanTime}</span>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generateVIPScanNotificationText(data: VIPScanNotificationData): string {
  const {
    attendeeEmail,
    attendeeName,
    eventName,
    ticketId,
    scanTime,
    scannerName,
    scannerEmail,
  } = data;

  const formattedScanTime = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: PACIFIC_TIMEZONE,
  }).format(new Date(scanTime));

  return `
VIP Ticket Scanned

A VIP ticket has been scanned for the following event:

Event: ${eventName}
Attendee Email: ${attendeeEmail}
${attendeeName ? `Attendee Name: ${attendeeName}\n` : ""}Ticket ID: ${ticketId}
Scan Time: ${formattedScanTime}
${scannerName ? `Scanned By: ${scannerName}${scannerEmail ? ` (${scannerEmail})` : ""}\n` : scannerEmail ? `Scanned By: ${scannerEmail}\n` : ""}
  `.trim();
}

export async function sendVIPScanNotification(
  data: VIPScanNotificationData,
): Promise<void> {
  if (process.env.DISABLE_EMAIL?.toLowerCase().trim() == "true") {
    console.log(
      `Email sending is disabled (DISABLE_EMAIL=true). Skipping VIP scan notification email`,
    );
    return;
  }

  const subject = `VIP Ticket Scanned: ${data.eventName}`;
  const textContent = generateVIPScanNotificationText(data);
  const htmlContent = generateVIPScanNotificationHTML(data);

  // Build MIME message
  const boundary = `mix_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const lines: string[] = [];
  lines.push(
    `From: ${FROM_EMAIL}`,
    `To: anish.anne@stanford.edu`,
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

  await sendRawEmailViaSES(rawMessage);
  console.log(`VIP scan notification email sent to anish.anne@stanford.edu`);
}
