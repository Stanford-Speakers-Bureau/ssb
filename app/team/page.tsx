import type { Metadata } from "next";
import TeamClient from "./TeamClient";

export const metadata: Metadata = {
  title: "Our Team",
  description:
    "Meet the leadership and directors behind Stanford Speakers Bureau.",
};

export default function Team() {
  return <TeamClient />;
}
