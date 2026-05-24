"use client";

import { motion } from "motion/react";
import { glassPanel, redButtonBase } from "./ui";

type ExternalTicketingCTAProps = {
  url: string;
};

export default function ExternalTicketingCTA({
  url,
}: ExternalTicketingCTAProps) {
  return (
    <div className="event-ticket-section flex flex-col gap-5">
      <div className={glassPanel + " p-4 sm:p-5"}>
        <motion.a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`${redButtonBase} block w-full text-center`}
        >
          Get Tickets
        </motion.a>
        <p className="mt-3 text-center text-xs text-[var(--ssb-muted)]">
          Tickets for this event are handled off-platform.
        </p>
      </div>
    </div>
  );
}
