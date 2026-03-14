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
    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/20 p-4 sm:p-5 space-y-5">
      <section>
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
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
          Prohibited items
        </h3>
        <ul className="text-sm text-amber-700 dark:text-amber-100/80 space-y-1.5 list-disc list-inside ml-1">
          <li>Bags, including small purse</li>
          <li>Food or drink, including water bottles</li>
          <li>Signs, flags, banners, or flyers of any kind</li>
          <li>Chairs of any kind (ADA seating will be provided on-site)</li>
          <li>Weapons, including those with concealed carry permits</li>
        </ul>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
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
          Event Restrictions
        </h3>
        <ul className="text-sm text-amber-700 dark:text-amber-100/80 space-y-1.5 list-disc list-inside ml-1">
          <li>This is a private event and capacity is limited.</li>
          <li>No re-entry will be permitted.</li>
          <li>All items are subject to search.</li>
          <li>A ticket does not guarantee seating.</li>
          <li>Please turn off all cell phones and alarms.</li>
        </ul>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
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
          Media Policy
        </h3>
        <ul className="text-sm text-amber-700 dark:text-amber-100/80 space-y-1.5 list-disc list-inside ml-1">
          <li>Attendees may be photographed or recorded.</li>
          <li>No photography or recording, aside from pre-approved media.</li>
        </ul>
      </section>
      <p className="text-sm font-bold text-amber-700 dark:text-amber-100/80">Entering the venue shall be deemed consenting to all of the above condition and any others set by Stanford University.</p>
    </div>
  );
}
