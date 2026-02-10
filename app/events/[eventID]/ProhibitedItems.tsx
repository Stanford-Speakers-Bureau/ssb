"use client";

import { useState, useEffect } from "react";

type ProhibitedItemsProps = {
  initialShow: boolean;
};

export default function ProhibitedItems({ initialShow }: ProhibitedItemsProps) {
  const [show, setShow] = useState(initialShow);

  useEffect(() => {
    const handleTicketChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        hasTicket: boolean;
        ticketId: string | null;
      }>;
      if (customEvent.detail) {
        setShow(customEvent.detail.hasTicket);
      }
    };

    window.addEventListener("ticketChanged", handleTicketChange);
    return () => {
      window.removeEventListener("ticketChanged", handleTicketChange);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/20 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2.5 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        Prohibited Items
      </h3>
      <ul className="text-sm text-amber-700 dark:text-amber-100/80 space-y-1.5 list-disc list-inside ml-1">
        <li>No bags, including purses</li>
        <li>No water bottles</li>
      </ul>
    </div>
  );
}
