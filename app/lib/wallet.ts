import { PKPass } from "passkit-generator";
import { PACIFIC_TIMEZONE } from "@/app/lib/constants";
import { SignJWT, importPKCS8 } from "jose";
import { formatInTimeZone } from "date-fns-tz";
import { fetchWithTimeout } from "./fetch";
import { deriveAppleWalletAuthToken } from "./wallet-links";
import { generateGoogleCalendarUrl } from "./utils";

type TicketWalletData = {
  email: string;
  name?: string | null;
  eventName: string;
  ticketType: string;
  eventDoorTime: string;
  ticketId: string;
  eventVenue: string;
  eventVenueLink: string;
  eventLink: string;
  eventLat: number;
  eventLng: number;
  eventAddress: string;
  start_time_date: string;
  cancelled?: boolean | null;
  checkedIn?: boolean | null;
};

const WALLET_ASSET_FETCH_TIMEOUT_MS = 10_000;

function toValidDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPacificTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PACIFIC_TIMEZONE,
  }).format(date);
}

function formatPacificDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: PACIFIC_TIMEZONE,
  }).format(date);
}

export async function getAppleWalletPass(
  image_buffer: Buffer,
  ticket: TicketWalletData,
) {
  if (
    !process.env.APPLE_WALLET_G4 ||
    !process.env.APPLE_WALLET_CERT ||
    !process.env.APPLE_WALLET_KEY
  ) {
    throw new Error("Missing required Apple Wallet environment variables");
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const [
    logoText1xRes,
    logoText2xRes,
    logoText3xRes,
    logo1xRes,
    logo2xRes,
    logo3xRes,
  ] = await Promise.all([
    fetchWithTimeout(
      `${baseUrl}/wallet/logo_text1x.png`,
      {},
      WALLET_ASSET_FETCH_TIMEOUT_MS,
    ),
    fetchWithTimeout(
      `${baseUrl}/wallet/logo_text2x.png`,
      {},
      WALLET_ASSET_FETCH_TIMEOUT_MS,
    ),
    fetchWithTimeout(
      `${baseUrl}/wallet/logo_text3x.png`,
      {},
      WALLET_ASSET_FETCH_TIMEOUT_MS,
    ),
    fetchWithTimeout(
      `${baseUrl}/wallet/logo1x.png`,
      {},
      WALLET_ASSET_FETCH_TIMEOUT_MS,
    ),
    fetchWithTimeout(
      `${baseUrl}/wallet/logo2x.png`,
      {},
      WALLET_ASSET_FETCH_TIMEOUT_MS,
    ),
    fetchWithTimeout(
      `${baseUrl}/wallet/logo3x.png`,
      {},
      WALLET_ASSET_FETCH_TIMEOUT_MS,
    ),
  ]);

  if (!logoText1xRes.ok || !logoText2xRes.ok || !logoText3xRes.ok)
    throw new Error("Failed to load logo_text.png");
  if (!logo1xRes.ok || !logo2xRes.ok || !logo3xRes.ok)
    throw new Error("Failed to load logo.png");

  const [
    logoTextBuffer1x,
    logoTextBuffer2x,
    logoTextBuffer3x,
    logoBuffer1x,
    logoBuffer2x,
    logoBuffer3x,
  ] = await Promise.all([
    Buffer.from(await logoText1xRes.arrayBuffer()),
    Buffer.from(await logoText2xRes.arrayBuffer()),
    Buffer.from(await logoText3xRes.arrayBuffer()),
    Buffer.from(await logo1xRes.arrayBuffer()),
    Buffer.from(await logo2xRes.arrayBuffer()),
    Buffer.from(await logo3xRes.arrayBuffer()),
  ]);

  const buffers = {
    "logo.png": logoTextBuffer1x,
    "logo@2x.png": logoTextBuffer2x,
    "logo@3x.png": logoTextBuffer3x,
    "icon.png": logoBuffer1x,
    "icon@2x.png": logoBuffer2x,
    "icon@3x.png": logoBuffer3x,
    "strip.png": image_buffer,
  };

  const certificates = {
    wwdr: Buffer.from(process.env.APPLE_WALLET_G4, "base64").toString("utf-8"),
    signerCert: Buffer.from(process.env.APPLE_WALLET_CERT, "base64").toString(
      "utf-8",
    ),
    signerKey: Buffer.from(process.env.APPLE_WALLET_KEY, "base64").toString(
      "utf-8",
    ),
  };

  const isVIP = ticket.ticketType?.toUpperCase().trim() === "VIP";
  const isExternal = ticket.ticketType?.toUpperCase().trim() === "EXTERNAL";
  const isCancelled = ticket.cancelled === true;
  // A scanned (checked-in) ticket is "used": it's voided like a cancellation so
  // iOS greys it out at the door, but it carries a welcoming status, not a
  // cancellation note. Cancellation wins if both are somehow set.
  const isCheckedIn = ticket.checkedIn === true && !isCancelled;
  const statusValue = isCancelled
    ? "Cancelled"
    : isCheckedIn
      ? "Checked In ✓"
      : "Active";
  // webServiceURL + authenticationToken make the pass updatable: the device
  // registers with our PassKit web service and we push refreshes via APNs.
  // Only passes issued with these fields can ever receive remote updates.
  const authenticationToken = await deriveAppleWalletAuthToken(ticket.ticketId);
  const props = {
    passTypeIdentifier: "pass.com.stanfordspeakersbureau.ticket",
    teamIdentifier: "SNC2X5N2CY",
    serialNumber: ticket.ticketId,
    organizationName: "Stanford Speakers Bureau",
    webServiceURL: `${baseUrl}/api/wallet`,
    authenticationToken,
    voided: isCancelled || isCheckedIn,

    description: ticket.ticketType,
    backgroundColor: isVIP
      ? "rgb(122, 92, 0)"
      : isExternal
        ? "rgb(22, 101, 52)"
        : "rgb(168, 13, 12)",
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: isVIP
      ? "rgb(255, 235, 180)"
      : isExternal
        ? "rgb(187, 247, 208)"
        : "rgb(255, 215, 0)",
  };

  // DB timestamps are stored as timestamptz (UTC). toISOString() in the route
  // produces a UTC "Z" string — parse directly rather than re-applying a
  // Pacific offset via fromZonedTime, which would double-shift the time.
  // Missing/invalid timestamps yield null so date-dependent fields are skipped
  // rather than throwing when formatted (Intl throws on an Invalid Date).
  const doorTime = toValidDate(ticket.eventDoorTime);
  const startTime = toValidDate(ticket.start_time_date);

  // Shared semantic tags. These let iOS surface native event intelligence
  // (smart date headers, one-tap Get Directions, time-to-leave, richer
  // lock-screen relevance) without changing the visible layout.
  const eventSemantics: Record<string, unknown> = {
    eventName: ticket.eventName,
    eventType: "PKEventTypeGeneric",
  };
  if (startTime) eventSemantics.eventStartDate = startTime.toISOString();
  if (doorTime) {
    eventSemantics.eventEndDate = new Date(
      doorTime.getTime() + 86_400_000,
    ).toISOString();
  }
  const venueSemantics: Record<string, unknown> = { venueName: ticket.eventVenue };
  if (ticket.eventLat && ticket.eventLng) {
    venueSemantics.venueLocation = {
      latitude: ticket.eventLat,
      longitude: ticket.eventLng,
    };
  }

  const pass = new PKPass(buffers, certificates, props);
  pass.type = "eventTicket";
  // changeMessage lives on exactly ONE field per logical attribute (the
  // user-facing front field). The back-of-pass mirrors below update silently.
  // If two fields with a changeMessage changed in the same update, iOS can't
  // pick one line and falls back to the generic "<pass style> changed" banner.
  if (doorTime) {
    pass.headerFields.push({
      key: "date-time",
      label: formatPacificTime(doorTime),
      value: formatPacificDate(doorTime),
      changeMessage: "Heads up — the event is now %@.",
      textAlignment: "PKTextAlignmentLeft",
      semantics: eventSemantics,
    });
  }
  pass.secondaryFields.push(
    {
      key: "event",
      label: "Event",
      value: ticket.eventName,
      changeMessage: "Event updated to %@.",
      textAlignment: "PKTextAlignmentLeft",
      semantics: { eventName: ticket.eventName },
    },
    {
      key: "loc",
      label: "Location",
      value: ticket.eventVenue,
      changeMessage: "📍 New location: %@.",
      textAlignment: "PKTextAlignmentLeft",
      semantics: venueSemantics,
    },
  );
  pass.auxiliaryFields.push({
    key: "type",
    label: "Type",
    value: ticket.ticketType,
    changeMessage: "Your ticket is now %@.",
    textAlignment: "PKTextAlignmentLeft",
  });
  // Always render the attendee field (placeholder when empty) so its key never
  // appears/disappears — a structural change also triggers the generic banner.
  pass.auxiliaryFields.push({
    key: "attendee",
    label: "Attendee",
    value: ticket.name || "—",
    changeMessage: "This ticket is now under the name %@.",
    textAlignment: "PKTextAlignmentRight",
  });
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: ticket.ticketId,
    messageEncoding: "iso-8859-1",
    altText: ticket.name || ticket.email,
  });
  pass.backFields.push({
    key: "back-status",
    label: "Status",
    value: statusValue,
    // The check-in push rides on this single, always-present field so iOS shows
    // our welcome line rather than the generic "<pass> changed" banner. (Adding
    // a new back field on scan would be a structural change and suppress it.)
    changeMessage: isCheckedIn
      ? "✅ %@ — welcome to the event!"
      : "Ticket status changed to %@.",
  });
  if (isCancelled) {
    pass.backFields.push({
      key: "back-cancelled-note",
      label: "Cancellation",
      value: "This ticket has been cancelled and is no longer valid for entry.",
    });
  }
  // Tappable action links for the back of the pass.
  const mapsDirections =
    ticket.eventLat && ticket.eventLng
      ? `https://maps.apple.com/?daddr=${ticket.eventLat},${ticket.eventLng}` +
        (ticket.eventVenue ? `&q=${encodeURIComponent(ticket.eventVenue)}` : "")
      : null;
  const directionsUrl = ticket.eventVenueLink || mapsDirections;
  const calendarUrl =
    generateGoogleCalendarUrl({
      eventName: ticket.eventName,
      eventStartTime: ticket.start_time_date || null,
      eventVenue: ticket.eventVenue,
      ticketId: ticket.ticketId,
      ticketEmail: ticket.email,
      ticketType: ticket.ticketType,
    }) || null;
  // Plain email address: Wallet's data detector linkifies it into a mail
  // composer. A full mailto:?subject= URI would render as literal text instead.
  const supportEmail =
    process.env.SES_FROM_EMAIL || "tickets@stanfordspeakersbureau.com";

  // Back-of-pass mirrors update silently (no changeMessage) so they don't
  // compete with the front fields for the notification banner.
  pass.backFields.push({
    key: "back-name",
    label: "Name",
    value: ticket.name ?? "Not provided",
  });
  pass.backFields.push(
    {
      key: "back-event",
      label: "Event",
      value: ticket.eventName,
    },
    ...(startTime
      ? [
          {
            key: "back-start-time",
            label: "Start Time",
            value: formatPacificTime(startTime),
          },
        ]
      : []),
    ...(doorTime
      ? [
          {
            key: "back-door-time",
            label: "Doors Open",
            value: formatPacificTime(doorTime),
          },
          {
            key: "back-date",
            label: "Date",
            value: formatPacificDate(doorTime),
          },
        ]
      : []),
    {
      key: "back-type",
      label: "Ticket Type",
      value: ticket.ticketType,
    },
    {
      key: "back-id",
      label: "Ticket ID",
      value: ticket.ticketId,
    },
    {
      key: "back-email",
      label: "Email",
      value: ticket.email,
    },
    {
      key: "back-loc",
      label: "Location",
      value: ticket.eventVenue,
    },
    // Prefer the venue's own directions link; otherwise route to the
    // coordinates in Apple Maps. Wallet renders these URLs as tappable links.
    ...(directionsUrl
      ? [
          {
            key: "back-loc-link",
            label: "Directions",
            value: directionsUrl,
          },
        ]
      : []),
    {
      key: "back-event-link",
      label: "Event Details",
      value: ticket.eventLink,
    },
    ...(calendarUrl
      ? [
          {
            key: "back-calendar",
            label: "Add to Calendar",
            value: calendarUrl,
          },
        ]
      : []),
    {
      key: "back-contact",
      label: "Questions?",
      value: supportEmail,
    },
  );
  // Surface the pass on the lock screen near the venue. Note: iOS gets stricter
  // about lock-screen relevance when both location and time are present and
  // tends to favor one signal at a time — both are still valid to set.
  if (ticket.eventLat && ticket.eventLng) {
    pass.setLocations({
      latitude: ticket.eventLat,
      longitude: ticket.eventLng,
      relevantText: `${ticket.eventName} is here`,
    });
  }
  if (doorTime) {
    pass.setExpirationDate(new Date(doorTime.getTime() + 86_400_000));
    pass.setRelevantDates([
      { relevantDate: doorTime },
      ...(startTime ? [{ relevantDate: startTime }] : []),
    ]);
  }

  return pass.getAsBuffer();
}

export async function getGoogleWalletPass(
  image_signed: string, // Note: We don't use this directly in the JWT, see below
  ticket: TicketWalletData,
) {
  // 1. Validation
  if (!process.env.GOOGLE_WALLET_KEY || !process.env.GOOGLE_WALLET_EMAIL) {
    throw new Error("Missing required Google Wallet environment variables");
  }

  const privateKey = process.env.GOOGLE_WALLET_KEY.replace(/\\n/g, "\n");
  const serviceEmail = process.env.GOOGLE_WALLET_EMAIL;

  const issuerId = "3388000000023060627";

  const classId = `${issuerId}.Event_${ticket.eventName.replace(/\W/g, "")}`;
  const objectId = `${issuerId}.${ticket.ticketId}`;

  const claims = {
    iss: serviceEmail,
    aud: "google",
    origins: ["https://stanfordspeakersbureau.com/"],
    typ: "savetowallet",
    payload: {
      eventTicketClasses: [
        {
          id: classId,
          reviewStatus: "UNDER_REVIEW",
          eventName: {
            defaultValue: { language: "en-US", value: ticket.eventName },
          },
          dateTime: {
            doorsOpen: formatInTimeZone(
              ticket.eventDoorTime,
              PACIFIC_TIMEZONE,
              "yyyy-MM-dd'T'HH:mmXXX",
            ),
            start: formatInTimeZone(
              ticket.start_time_date,
              PACIFIC_TIMEZONE,
              "yyyy-MM-dd'T'HH:mmXXX",
            ),
          },
          issuerName: "Stanford Speakers Bureau",
          hexBackgroundColor:
            ticket.ticketType?.toUpperCase().trim() === "VIP"
              ? "#7A5C00"
              : ticket.ticketType?.toUpperCase().trim() === "EXTERNAL"
                ? "#166534"
                : "#A80D0C",
          heroImage: {
            sourceUri: {
              uri: image_signed,
            },
          },
          locations: [
            {
              latitude: ticket.eventLat,
              longitude: ticket.eventLng,
            },
          ],
          venue: {
            name: {
              defaultValue: { language: "en-US", value: ticket.eventVenue },
            },
            address: {
              defaultValue: { language: "en-US", value: ticket.eventAddress },
            },
          },
          logo: {
            sourceUri: {
              uri: `https://stanfordspeakersbureau.com/logo.png`,
            },
            contentDescription: {
              defaultValue: { language: "en-US", value: "Logo" },
            },
          },
        },
      ],
      eventTicketObjects: [
        {
          id: objectId,
          classId: classId,
          state: "ACTIVE",
          barcode: {
            type: "QR_CODE",
            value: ticket.ticketId,
            alternateText: ticket.name || ticket.email,
          },
          locations: [
            {
              kind: "requestingTenant",
              latitude: ticket.eventLat,
              longitude: ticket.eventLng,
            },
          ],
          seatInfo: {
            section: {
              defaultValue: { language: "en-US", value: ticket.ticketType },
            },
          },
          textModulesData: [
            ...(ticket.name ? [{ header: "Name", body: ticket.name }] : []),
            { header: "Ticket ID", body: ticket.ticketId },
            { header: "Email", body: ticket.email },
          ],
          linksModuleData: {
            uris: [
              {
                kind: "website",
                uri: ticket.eventLink,
                description: "Event Details",
              },
            ],
          },
        },
      ],
    },
  };

  // 5. Sign the JWT using jose (edge-compatible)
  const key = await importPKCS8(privateKey, "RS256");
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .sign(key);

  return `https://pay.google.com/gp/v/save/${token}`;
}
