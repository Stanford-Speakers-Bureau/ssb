import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Stanford Speakers Bureau. Share event ideas, speaker suggestions, or ask about co-sponsorship opportunities.",
};

export default function Contact() {
  return <ContactClient />;
}
