import type { Metadata } from "next";
import PastSpeakersClient from "./PastSpeakersClient";

export const metadata: Metadata = {
  title: "Past Speakers",
  description:
    "Explore the history of speakers hosted by Stanford Speakers Bureau since 1935.",
  openGraph: {
    title: "The Archive",
    description:
      "A living record of the voices who have stood on Stanford's stage since 1935.",
    type: "website",
    siteName: "Stanford Speakers Bureau",
    url: "/past-speakers",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Archive",
    description:
      "A living record of the voices who have stood on Stanford's stage since 1935.",
  },
};

export default function PastSpeakers() {
  return <PastSpeakersClient />;
}
