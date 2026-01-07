"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

type TicketCountProps = {
  eventId: string;
  initialPublicSold: number; // Public tickets sold (excludes VIPs)
  initialMaxPublic: number; // Max public capacity (with overflow handling)
};

export default function TicketCount({
  eventId,
  initialPublicSold,
  initialMaxPublic,
}: TicketCountProps) {
  const [publicSold, setPublicSold] = useState(initialPublicSold);
  const maxPublic = initialMaxPublic; // Already calculated server-side

  const fetchTicketCount = () => {
    fetch(`/api/tickets?count=true&event_id=${eventId}`)
      .then(
        (res) =>
          res.json() as Promise<{
            count?: number;
            available?: number;
            maxPublic?: number;
          }>,
      )
      .then((data) => {
        if (data.count !== undefined) {
          setPublicSold(data.count); // Update with public count only
        }
      })
      .catch((err) => {
        console.error("Failed to fetch ticket count:", err);
      });
  };

  useEffect(() => {
    // Fetch initial count on mount
    fetchTicketCount();

    // Listen for custom event to refresh ticket count
    const handleTicketChange = () => {
      fetchTicketCount();
    };

    window.addEventListener("ticketChanged", handleTicketChange);

    return () => {
      window.removeEventListener("ticketChanged", handleTicketChange);
    };
  }, [eventId]);

  const ticketsLeft = Math.max(0, maxPublic - publicSold);

  return (
    <div className="flex items-center gap-2">
      <svg
        className="w-4 h-4 md:w-5 md:h-5 text-red-500 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <p className="text-sm sm:text-base text-white font-medium">
        Tickets left:{" "}
        <span className="relative inline-flex items-center overflow-hidden h-[1.5rem]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ticketsLeft}
              initial={{ y: -24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute left-0"
            >
              {ticketsLeft}
            </motion.span>
          </AnimatePresence>
          <span className="invisible">{ticketsLeft}</span>
        </span>{" "}
        / {maxPublic}
      </p>
    </div>
  );
}
