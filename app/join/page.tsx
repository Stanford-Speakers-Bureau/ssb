import type { Metadata } from "next";
import JoinClient from "./JoinClient";

export const metadata: Metadata = {
  title: "Join SSB",
  description:
    "Stanford Speakers Bureau recruits new board members every fall. Join the mailing list to be notified when applications open.",
};

export default function Join() {
  return <JoinClient />;
}
