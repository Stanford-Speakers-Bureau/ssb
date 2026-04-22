import type { Metadata } from "next";
import EventSponsorshipClient from "./EventSponsorshipClient";

export const metadata: Metadata = {
  title: "Event Sponsorship",
  description:
    "Learn about Stanford Speakers Bureau sponsorship programs including the Community Uplift Fund, co-sponsorships, and full-service partnerships.",
};

export default function EventSponsorshipPage() {
  return <EventSponsorshipClient />;
}
