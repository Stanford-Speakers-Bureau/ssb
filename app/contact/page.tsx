import type { Metadata } from "next";
import ContactClient from "./ContactClient";

const ogTitle = "Get in Touch with SSB";
const ogDescription =
  "Share event ideas, speaker suggestions, or ask about co-sponsorship opportunities.";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Stanford Speakers Bureau. Share event ideas, speaker suggestions, or ask about co-sponsorship opportunities.",
  openGraph: { title: ogTitle, description: ogDescription },
  twitter: { title: ogTitle, description: ogDescription },
};

export default function Contact() {
  return <ContactClient />;
}
