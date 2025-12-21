"use client";

import { useState, useEffect } from "react";
import {REFERRAL_MESSAGE} from "@/app/lib/constants";

type ReferralShareProps = {
  referralCode: string;
  route: string;
  eventId: string;
  className?: string;
  compact?: boolean;
};

export default function ReferralShare({
  referralCode,
  route,
  eventId,
  className,
  compact = true,
}: ReferralShareProps) {
  const [copied, setCopied] = useState(false);
  const [referralUrl, setReferralUrl] = useState<string>("");
  const [referralCount, setReferralCount] = useState<number | null>(null);

  useEffect(() => {
    // Generate URL on client side using route in path and referral code as query param
    setReferralUrl(
      `${window.location.origin}/events/${route}?referral_code=${referralCode}`,
    );
  }, [route, referralCode]);

  useEffect(() => {
    // Fetch referral count (API uses authenticated user's email to get their referral code)
    const fetchReferralCount = async () => {
      try {
        const response = await fetch(
          `/api/referrals?event_id=${encodeURIComponent(eventId)}`,
        );
        if (response.ok) {
          const data = await response.json();
          setReferralCount(data.count ?? 0);
        }
      } catch (error) {
        console.error("Failed to fetch referral count:", error);
      }
    };

    fetchReferralCount();

    // Listen for ticket changes to refresh referral count
    const handleTicketChange = () => {
      fetchReferralCount();
    };

    window.addEventListener("ticketChanged", handleTicketChange);

    return () => {
      window.removeEventListener("ticketChanged", handleTicketChange);
    };
  }, [eventId]);

  const handleCopy = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div
      className={[
        "bg-white/10 backdrop-blur-sm rounded-lg",
        compact ? "px-4 py-3 sm:px-5 sm:py-4" : "px-6 py-4 md:px-8 md:py-6",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <p className="text-white text-base sm:text-lg font-semibold mb-1">
            Share your referral code:{" "}
            <span className="text-red-400">{referralCode}</span>
          </p>
          <p className="text-zinc-300 text-sm sm:text-base">
            {REFERRAL_MESSAGE}{" "}
            {referralCount !== null && (
              <span className="text-white font-medium">
                ({referralCount}{" "}
                {referralCount === 1 ? "referral" : "referrals"})
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-[#A80D0C] hover:bg-[#C11211] text-white text-sm sm:text-base font-semibold rounded transition-colors whitespace-nowrap"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}
