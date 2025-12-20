import { PKPass } from "passkit-generator";
import * as fs from "node:fs";

type TicketWalletData = {
  email: string;
  eventName: string;
  ticketType: string;
  eventDoorTime: string;
  eventStartTime: string;
  ticketId: string;
  eventVenue: string;
};

export function getWalletPass(image_buffer: Buffer, ticket: TicketWalletData) {
  if (!process.env.APPLE_WALLET_G4 || !process.env.APPLE_WALLET_CERT || !process.env.APPLE_WALLET_KEY || !process.env.APPPLE_WALLET_PASSPHRASE) {
    throw new Error('Missing required Apple Wallet environment variables');
  }

  const buffers = {
    "logo.png": fs.readFileSync("./public/logo.png"),
    "icon.png": fs.readFileSync("./public/logo.png"),
    "strip.png": image_buffer
  }

  const certificates = {
    wwdr: process.env.APPLE_WALLET_G4,
    signerCert: process.env.APPLE_WALLET_CERT,
    signerKey: process.env.APPLE_WALLET_KEY,
    signerKeyPassphrase: process.env.APPPLE_WALLET_PASSPHRASE
  };

  const props = {
    // --- Identity ---
    passTypeIdentifier: "pass.com.stanfordspeakersbureau.ticket", // Must match your Apple Developer Portal ID
    teamIdentifier: "SNC2X5N2CY",                    // Your Apple Team ID
    serialNumber: ticket.ticketId,                       // Unique ID for THIS specific pass
    organizationName: "Stanford Speakers Bureau",

    // --- Appearance ---
    description: ticket.ticketType,
    logoText: "Stanford Speakers Bureau",
    backgroundColor: "rgb(168, 13, 12)",
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(200, 200, 200)",

    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: ticket.ticketId,
        messageEncoding: "iso-8859-1",
        altText: ticket.email
      }
    ],

    eventTicket: {
      primaryFields: [
        {
          key: "event",
          label: "EVENT",
          value: ticket.eventName,
          textAlignment: "PKTextAlignmentCenter"
        }
      ],
      secondaryFields: [
        {
          key: "loc",
          label: "LOCATION",
          value: ticket.eventVenue
        }
      ],
      auxiliaryFields: [
        {
          key: "door-time",
          label: "DOOR OPEN TIME",
          value: ticket.eventDoorTime
        },
        {
          key: "start-time",
          label: "EVENT START TIME",
          value: ticket.eventStartTime
        }
      ]
    }
  };

  const pass = new PKPass(buffers, certificates, props);

  return pass.getAsBuffer();
}