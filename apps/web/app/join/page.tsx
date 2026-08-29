import type { Metadata } from "next";
import JoinClient from "./JoinClient";

const ogTitle = "Join SSB";
const ogDescription =
  "Help bring the world's most interesting people to Stanford. Apps open every fall.";

export const metadata: Metadata = {
  title: "Join SSB",
  description:
    "Stanford Speakers Bureau recruits new board members every fall. Join the mailing list to be notified when applications open.",
  openGraph: { title: ogTitle, description: ogDescription },
  twitter: { title: ogTitle, description: ogDescription },
};

export default function Join() {
  return <JoinClient />;
}
