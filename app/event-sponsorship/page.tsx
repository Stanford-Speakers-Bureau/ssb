import type { Metadata } from "next";
import EventSponsorshipClient from "./EventSponsorshipClient";

const ogTitle = "Partner with SSB";
const ogDescription =
  "Partner with Stanford's largest speaker series — co-sponsorships, the Community Uplift Fund, and full-service partnerships.";

export const metadata: Metadata = {
  title: "Event Sponsorship",
  description:
    "Learn about Stanford Speakers Bureau sponsorship programs including the Community Uplift Fund, co-sponsorships, and full-service partnerships.",
  openGraph: { title: ogTitle, description: ogDescription },
  twitter: { title: ogTitle, description: ogDescription },
};

export default function EventSponsorshipPage() {
  return <EventSponsorshipClient />;
}
