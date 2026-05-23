import type { SpeakerCardVM } from "./shared";

/**
 * Dev-only placeholder so the theme picker is previewable when there are no
 * live events locally. SSB usually has a single upcoming speaker at a time, so
 * the sample is one featured speaker. Never used in production (see page.tsx).
 * Imagery reuses a real past-speaker photo already in /public/speakers.
 */
export const SAMPLE_VMS: SpeakerCardVM[] = [
  {
    id: "sample-mark-rober",
    mystery: false,
    name: "Mark Rober",
    header:
      "Former NASA engineer turned YouTube's favorite mad scientist, building the world's most over-engineered backyard experiments.",
    dateText: "Friday, May 30th",
    doorsOpenText: "Doors open 6:30 PM",
    eventTimeText: "Starts at 7:00 PM",
    locationName: "Memorial Auditorium",
    locationUrl: "https://maps.google.com",
    imageUrl: "/speakers/mark-rober-web.jpeg",
    ctaHref: "#",
    ctaText: "Get Tickets",
    revealDateRaw: null,
    capacity: 1700,
    ticketsSold: 1410,
    reserved: 120,
    isAlreadyNotified: false,
  },
];
