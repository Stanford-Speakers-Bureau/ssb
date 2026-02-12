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
        Important Event Restrictions
      </h3>
      <ul className="text-sm text-amber-700 dark:text-amber-100/80 space-y-1.5 list-disc list-inside ml-1">
        <li>This is a private event and capacity is limited.</li>
        <li>No bags larger than a clutch purse.</li>
        <li>No food or drink, including water bottles.</li>
        <li>No signs, flags, banners, or flyers of any kind.</li>
        <li>No chairs of any kind (ADA seating will be provided on-site).</li>
        <li>No weapons, including those with concealed carry permits</li>
        <li>No re-entry will be permitted.</li>
        <li>No photography or recording, aside from pre-approved media. Media requests must be made by Tuesday, February 17th by emailing <a href="mailto:tickets@stanfordspeakersbureau.com" className="text-amber-500 dark:text-amber-100/90 underline underline-offset-2 decoration-amber-300 dark:decoration-amber-600 hover:text-amber-900 dark:hover:text-amber-300 transition-colors">tickets@stanfordspeakersbureau.com</a>.</li>
        <li>All items are subject to search.</li>
        <li>A ticket does not guarantee seating.</li>
        <li>Please turn off all cell phones and alarms.</li>
      </ul>
      <p className="text-sm text-amber-700 dark:text-amber-100/80 mt-2">Entering the venue shall be deemed consenting to all of the above condition and any others set by Stanford University. For ADA accommodations, please email <a href="mailto:tickets@stanfordspeakersbureau.com" className="text-amber-500 dark:text-amber-100/90 underline underline-offset-2 decoration-amber-300 dark:decoration-amber-600 hover:text-amber-900 dark:hover:text-amber-300 transition-colors">tickets@stanfordspeakersbureau.com</a>.</p>
    </div>
  );
}
