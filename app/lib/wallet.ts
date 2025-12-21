import {PKPass} from "passkit-generator";
import {PACIFIC_TIMEZONE} from "@/app/lib/constants";

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
};

export async function getWalletPass(image_buffer: Buffer, ticket: TicketWalletData) {
  if (!process.env.APPLE_WALLET_G4 || !process.env.APPLE_WALLET_CERT || !process.env.APPLE_WALLET_KEY) {
    throw new Error('Missing required Apple Wallet environment variables');
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const [logoText1xRes, logoText2xRes, logoText3xRes, logo1xRes, logo2xRes, logo3xRes] = await Promise.all([
    fetch(`${baseUrl}/wallet/logo_text1x.png`),
    fetch(`${baseUrl}/wallet/logo_text2x.png`),
    fetch(`${baseUrl}/wallet/logo_text3x.png`),
    fetch(`${baseUrl}/wallet/logo1x.png`),
    fetch(`${baseUrl}/wallet/logo2x.png`),
    fetch(`${baseUrl}/wallet/logo3x.png`),
  ]);

  if (!logoText1xRes.ok || !logoText2xRes.ok || !logoText3xRes.ok) throw new Error("Failed to load logo_text.png");
  if (!logo1xRes.ok || !logo2xRes.ok || !logo3xRes.ok) throw new Error("Failed to load logo.png");

  const [logoTextBuffer1x, logoTextBuffer2x, logoTextBuffer3x, logoBuffer1x, logoBuffer2x, logoBuffer3x] = await Promise.all([
    Buffer.from(await logoText1xRes.arrayBuffer()),
    Buffer.from(await logoText2xRes.arrayBuffer()),
    Buffer.from(await logoText3xRes.arrayBuffer()),
    Buffer.from(await logo1xRes.arrayBuffer()),
    Buffer.from(await logo2xRes.arrayBuffer()),
    Buffer.from(await logo3xRes.arrayBuffer())
  ]);

  const buffers = {
    "logo.png": logoTextBuffer1x,
    "logo@2x.png": logoTextBuffer2x,
    "logo@3x.png": logoTextBuffer3x,
    "icon.png": logoBuffer1x,
    "icon@2x.png": logoBuffer2x,
    "icon@3x.png": logoBuffer3x,
    "strip.png": image_buffer
  };

  const certificates = {
    wwdr: Buffer.from(process.env.APPLE_WALLET_G4, 'base64').toString('utf-8'),
    signerCert: Buffer.from(process.env.APPLE_WALLET_CERT, 'base64').toString('utf-8'),
    signerKey: Buffer.from(process.env.APPLE_WALLET_KEY, 'base64').toString('utf-8'),
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
  pass.headerFields.push(
    {
      key: "date-time",
      label: new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: PACIFIC_TIMEZONE,
      }).format(new Date(ticket.eventDoorTime)),
      value:
        new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: PACIFIC_TIMEZONE,
        }).format(new Date(ticket.eventDoorTime)),
      textAlignment: "PKTextAlignmentLeft"
    }
  )
  pass.secondaryFields.push(
    {
      key: "event",
      label: "Event",
      value: ticket.eventName,
      textAlignment: "PKTextAlignmentLeft"
    },
    {
      key: "loc",
      label: "Location",
      value: ticket.eventVenue,
      textAlignment: "PKTextAlignmentLeft"
    }
  )
  pass.auxiliaryFields.push(
    {
      key: "type",
      label: "Type",
      value: ticket.ticketType,
      textAlignment: "PKTextAlignmentLeft"
    },
  )
  pass.setBarcodes(
    {
      format: "PKBarcodeFormatQR",
      message: ticket.ticketId,
      messageEncoding: "iso-8859-1",
      altText: ticket.email
    }
  );
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
    }
  )
  pass.setExpirationDate(
    new Date(Date.parse(ticket.eventDoorTime) + 86_400_000)
  );
  pass.setLocations(
    {
      latitude: ticket.eventLat,
      longitude: ticket.eventLng,
    },
  )
  pass.setRelevantDates([
    { date: new Date(ticket.eventDoorTime) },
  ])
  pass.setRelevantDate(
    new Date(ticket.eventDoorTime)
  )

  return pass.getAsBuffer();
}