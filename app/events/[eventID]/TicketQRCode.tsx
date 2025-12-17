"use client";

import { QRCodeSVG } from "qrcode.react";
import { motion } from "motion/react";

type TicketQRCodeProps = {
  ticketId: string;
  size?: number;
  compact?: boolean;
  ticketType?: string | null;
};

export default function TicketQRCode({
  ticketId,
  size = 220,
  compact = true,
  ticketType = null,
}: TicketQRCodeProps) {
  const isVIP = ticketType?.toLowerCase().trim() === "vip";

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {isVIP && (
          <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none z-10"
            style={{
              padding: "6px",
              background:
                "conic-gradient(from var(--angle), transparent 0deg, transparent 70deg, rgba(168, 13, 12, 0.55) 90deg, rgba(168, 13, 12, 0.55) 112deg, transparent 130deg, transparent 240deg, #A80D0C 270deg, #A80D0C 300deg, transparent 330deg, transparent 360deg)",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--angle" as any]: "0deg",
              willChange: "background",
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            animate={{ ["--angle" as any]: "360deg" }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
        <div
          className={`bg-white rounded-lg shadow-2xl border-4 border-white relative z-0 ${
            compact ? "p-3 sm:p-4" : "p-6 md:p-8"
          }`}
        >
          <QRCodeSVG
            value={ticketId}
            size={size}
            level="H"
            includeMargin={true}
          />
        </div>
      </div>
      {isVIP && (
        <div className="mt-2 px-3 py-1 bg-[#A80D0C] rounded-full">
          <p className="text-xs sm:text-sm font-bold text-white">VIP</p>
        </div>
      )}
      <p className="mt-2 text-xs sm:text-sm text-zinc-300 text-center max-w-xs">
        Show this QR code at the event entrance
      </p>
    </div>
  );
}
