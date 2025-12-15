"use client";

import { useState, useEffect } from "react";

type ReferralShareProps = {
  referralCode: string;
  route: string;
};

export default function ReferralShare({
  referralCode,
  route,
}: ReferralShareProps) {
  const [copied, setCopied] = useState(false);
  const [referralUrl, setReferralUrl] = useState<string>("");

  useEffect(() => {
    // Generate URL on client side using route in path and referral code as query param
    setReferralUrl(
      `${window.location.origin}/events/${route}?referral_code=${referralCode}`
    );
  }, [route, referralCode]);

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
    <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 md:px-6 py-3 md:py-4 mb-4 md:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <p className="text-white text-sm sm:text-base font-semibold mb-1">
            Share your referral code: <span className="text-red-400">{referralCode}</span>
          </p>
          <p className="text-zinc-300 text-xs sm:text-sm">
            Share this link with friends to get them tickets!
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-[#A80D0C] hover:bg-[#C11211] text-white text-sm font-semibold rounded transition-colors whitespace-nowrap"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}

