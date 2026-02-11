import type { Metadata } from "next";
import PastSpeakersClient from "./PastSpeakersClient";

export const metadata: Metadata = {
  title: "Past Speakers",
  description:
    "Explore the history of speakers hosted by Stanford Speakers Bureau since 1935.",
};

export default function PastSpeakers() {
  return <PastSpeakersClient />;
}
