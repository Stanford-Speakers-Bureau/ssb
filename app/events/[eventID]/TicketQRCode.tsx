"use client";

import { QRCodeSVG } from "qrcode.react";

type TicketQRCodeProps = {
  ticketId: string;
};

export default function TicketQRCode({ ticketId }: TicketQRCodeProps) {
  return (
    <div className="mt-4 md:mt-6 flex flex-col items-center">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-2xl border-4 border-white">
        <QRCodeSVG value={ticketId} size={280} level="H" includeMargin={true} />
      </div>
      <p className="mt-4 text-xs sm:text-sm text-zinc-300 text-center max-w-xs">
        Show this QR code at the event entrance
      </p>
    </div>
  );
}
