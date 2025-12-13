"use client";

import { QRCodeSVG } from "qrcode.react";

type TicketQRCodeProps = {
  ticketId: string;
};

export default function TicketQRCode({ ticketId }: TicketQRCodeProps) {
  return (
    <div className="mt-4 md:mt-6 flex flex-col items-center">
      <div className="bg-white p-4 rounded-lg">
        <QRCodeSVG
          value={ticketId}
          size={200}
          level="M"
          includeMargin={true}
        />
      </div>
      <p className="mt-3 text-xs sm:text-sm text-zinc-300 text-center">
        Show this QR code at the event entrance
      </p>
    </div>
  );
}

