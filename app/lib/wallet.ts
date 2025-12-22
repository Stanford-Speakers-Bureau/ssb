import { PKPass } from "passkit-generator";
import { PACIFIC_TIMEZONE } from "@/app/lib/constants";
import jwt from "jsonwebtoken";
import { fromZonedTime } from "date-fns-tz";

type TicketWalletData = {
  email: string;
  eventName: string;
  ticketType: string;
  eventDoorTime: string;
  ticketId: string;
  eventVenue: string;
  eventVenueLink: string;
  eventLink: string;
  eventLat: number;
  eventLng: number;
  eventAddress: number;
};

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
    fetch(`${baseUrl}/wallet/logo_text1x.png`),
    fetch(`${baseUrl}/wallet/logo_text2x.png`),
    fetch(`${baseUrl}/wallet/logo_text3x.png`),
    fetch(`${baseUrl}/wallet/logo1x.png`),
    fetch(`${baseUrl}/wallet/logo2x.png`),
    fetch(`${baseUrl}/wallet/logo3x.png`),
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

  const props = {
    passTypeIdentifier: "pass.com.stanfordspeakersbureau.ticket",
    teamIdentifier: "SNC2X5N2CY",
    serialNumber: ticket.ticketId,
    organizationName: "Stanford Speakers Bureau",

    description: ticket.ticketType,
    backgroundColor: "rgb(168, 13, 12)",
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(255, 215, 0)",
  };

  const pass = new PKPass(buffers, certificates, props);
  pass.type = "eventTicket";
  pass.headerFields.push({
    key: "date-time",
    label: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: PACIFIC_TIMEZONE,
    }).format(new Date(ticket.eventDoorTime)),
    value: new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: PACIFIC_TIMEZONE,
    }).format(new Date(ticket.eventDoorTime)),
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
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: ticket.ticketId,
    messageEncoding: "iso-8859-1",
    altText: ticket.email,
  });
  pass.backFields.push(
    {
      key: "back-event",
      label: "Event",
      value: ticket.eventName,
    },
    {
      key: "back-time",
      label: "Time",
      value: new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: PACIFIC_TIMEZONE,
      }).format(new Date(ticket.eventDoorTime)),
    },
    {
      key: "back-date",
      label: "Date",
      value: new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: PACIFIC_TIMEZONE,
      }).format(new Date(ticket.eventDoorTime)),
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
  pass.setExpirationDate(
    new Date(Date.parse(ticket.eventDoorTime) + 86_400_000),
  );
  pass.setLocations({
    latitude: ticket.eventLat,
    longitude: ticket.eventLng,
  });
  pass.setRelevantDates([{ date: new Date(ticket.eventDoorTime) }]);
  pass.setRelevantDate(new Date(ticket.eventDoorTime));

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

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://baconrista.com";
  // const heroImageUrl = `${baseUrl}/api/passes/image/${ticket.ticketId}`;

  const issuerId = "3388000000023060627";

  const classId = `${issuerId}.Event_${ticket.eventName.replace(/[^\w]/g, "")}`;
  const objectId = `${issuerId}.${ticket.ticketId}`;

  const claims = {
    iss: serviceEmail,
    aud: "google",
    origins: ["https://stanfordspeakersbureau.com/"],
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: {
      eventTicketClasses: [
        {
          id: classId,
          reviewStatus: "UNDER_REVIEW",
          eventName: {
            defaultValue: { language: "en-US", value: ticket.eventName },
          },
          dateTime: {
            start: fromZonedTime(
              ticket.eventDoorTime,
              PACIFIC_TIMEZONE,
            ).toISOString(),
          },
          issuerName: "Stanford Speakers Bureau",
          hexBackgroundColor: "#A80D0C",
          heroImage: {
            sourceUri: {
              uri: image_signed,
            },
          },
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
              // uri: `${baseUrl}/logo.png`
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
            alternateText: ticket.email,
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

  // 5. Sign the JWT
  const token = jwt.sign(claims, privateKey, { algorithm: "RS256" });

  return `https://pay.google.com/gp/v/save/${token}`;
}
