"use client";

import { NoticeBanner } from "../ui";
import { TICKET_MESSAGES } from "../useTicketActions";

export default function EventPassed() {
  return (
    <NoticeBanner
      color="zinc"
      icon={
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      }
    >
      {TICKET_MESSAGES.EVENT_PASSED}
    </NoticeBanner>
  );
}
