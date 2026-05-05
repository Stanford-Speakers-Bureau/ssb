import type { Metadata } from "next";
import TeamClient from "./TeamClient";

const ogTitle = "Meet the Team";
const ogDescription =
  "The students bringing world-class speakers to Stanford since 1935.";

export const metadata: Metadata = {
  title: "Our Team",
  description:
    "Meet the leadership and directors behind Stanford Speakers Bureau.",
  openGraph: { title: ogTitle, description: ogDescription },
  twitter: { title: ogTitle, description: ogDescription },
};

export default function Team() {
  return <TeamClient />;
}
