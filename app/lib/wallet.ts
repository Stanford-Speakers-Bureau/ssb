import { PKPass } from "passkit-generator";
import { PACIFIC_TIMEZONE } from "@/app/lib/constants";
import { SignJWT, importPKCS8 } from "jose";
import { formatInTimeZone } from "date-fns-tz";
import { fetchWithTimeout } from "./fetch";

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
};

const WALLET_ASSET_FETCH_TIMEOUT_MS = 10_000;

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
  const props = {
    passTypeIdentifier: "pass.com.stanfordspeakersbureau.ticket",
    teamIdentifier: "SNC2X5N2CY",
    serialNumber: ticket.ticketId,
    organizationName: "Stanford Speakers Bureau",

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
  const doorTimeUTC = new Date(ticket.eventDoorTime);
  const startTimeUTC = new Date(ticket.start_time_date);

  const pass = new PKPass(buffers, certificates, props);
  pass.type = "eventTicket";
  pass.headerFields.push({
    key: "date-time",
    label: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: PACIFIC_TIMEZONE,
    }).format(doorTimeUTC),
    value: new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: PACIFIC_TIMEZONE,
    }).format(doorTimeUTC),
    textAlignment: "PKTextAlignmentLeft",
  });
  pass.secondaryFields.push(
    {
      key: "event",
      label: "Event",
      value: ticket.eventName,
      textAlignment: "PKTextAlignmentLeft",
    },
    {
      key: "loc",
      label: "Location",
      value: ticket.eventVenue,
      textAlignment: "PKTextAlignmentLeft",
    },
  );
  pass.auxiliaryFields.push({
    key: "type",
    label: "Type",
    value: ticket.ticketType,
    textAlignment: "PKTextAlignmentLeft",
  });
  if (ticket.name) {
    pass.auxiliaryFields.push({
      key: "attendee",
      label: "Attendee",
      value: ticket.name,
      textAlignment: "PKTextAlignmentRight",
    });
  }
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: ticket.ticketId,
    messageEncoding: "iso-8859-1",
    altText: ticket.name || ticket.email,
  });
  if (ticket.name) {
    pass.backFields.push({
      key: "back-name",
      label: "Name",
      value: ticket.name,
    });
  }
  pass.backFields.push(
    {
      key: "back-event",
      label: "Event",
      value: ticket.eventName,
    },
    {
      key: "back-start-time",
      label: "Start Time",
      value: new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: PACIFIC_TIMEZONE,
      }).format(startTimeUTC),
    },
    {
      key: "back-door-time",
      label: "Doors Open",
      value: new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: PACIFIC_TIMEZONE,
      }).format(doorTimeUTC),
    },
    {
      key: "back-date",
      label: "Date",
      value: new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: PACIFIC_TIMEZONE,
      }).format(doorTimeUTC),
    },
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
    {
      key: "back-loc-link",
      label: "Directions",
      value: ticket.eventVenueLink,
    },
    {
      key: "back-event-link",
      label: "Event Details",
      value: ticket.eventLink,
    },
  );
  pass.setExpirationDate(new Date(doorTimeUTC.getTime() + 86_400_000));
  // iOS gets stricter when you provide both location and time data, so only provide time to maximize chances of success
  // pass.setLocations({
  //   latitude: ticket.eventLat,
  //   longitude: ticket.eventLng,
  // });
  pass.setRelevantDates([
    {
      relevantDate: doorTimeUTC,
    },
  ]);

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
