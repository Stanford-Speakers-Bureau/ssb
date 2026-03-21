"use client";

import { TICKET_MESSAGES } from "../useTicketActions";

export default function EventPassed() {
  return (
    <div>
      <div className="flex min-h-[3rem] items-center justify-center">
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 text-center">
          {TICKET_MESSAGES.EVENT_PASSED}
        </p>
      </div>
    </div>
  );
}
