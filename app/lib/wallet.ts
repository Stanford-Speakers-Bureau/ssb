import {PKPass} from "passkit-generator";
import * as fs from "node:fs";
import path from "node:path";
import {PACIFIC_TIMEZONE} from "@/app/lib/constants";
import sharp from "sharp";

type TicketWalletData = {
  email: string;
  eventName: string;
  ticketType: string;
  eventDoorTime: string;
  eventStartTime: string;
  ticketId: string;
  eventVenue: string;
};

export async function getWalletPass(image_buffer: Buffer, ticket: TicketWalletData) {
  if (!process.env.APPLE_WALLET_G4 || !process.env.APPLE_WALLET_CERT || !process.env.APPLE_WALLET_KEY) {
    throw new Error('Missing required Apple Wallet environment variables');
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const [logoTextRes, logoRes] = await Promise.all([
    fetch(`${baseUrl}/logo_text.png`),
    fetch(`${baseUrl}/logo.png`),
  ]);

  if (!logoTextRes.ok) throw new Error("Failed to load logo_text.png");
  if (!logoRes.ok) throw new Error("Failed to load logo.png");

  const [logoTextBuffer, logoBuffer] = await Promise.all([
    Buffer.from(await logoTextRes.arrayBuffer()),
    Buffer.from(await logoRes.arrayBuffer())
  ]);
  const resize = (buffer: Buffer<ArrayBuffer> | sharp.SharpOptions | undefined, width: number) =>
    sharp(buffer).resize({ width }).toBuffer();

  const buffers = {
    "logo.png":   await resize(logoTextBuffer, 200),
    "icon.png":   await resize(logoBuffer, 29),
    "logo.png@2": await resize(logoTextBuffer, 400),
    "icon.png@2": await resize(logoBuffer, 58),
    "logo.png@3": await resize(logoTextBuffer, 600),
    "icon.png@3": await resize(logoBuffer, 87),
    "strip.png": image_buffer
  }

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
      }).format(new Date(ticket.eventStartTime)),
      value:
        new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: PACIFIC_TIMEZONE,
        }).format(new Date(ticket.eventStartTime)),
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

  return pass.getAsBuffer();
}