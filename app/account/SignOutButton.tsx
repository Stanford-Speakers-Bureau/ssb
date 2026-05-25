"use client";

import { useState } from "react";
import { motion } from "motion/react";

export default function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      window.location.href = `/api/auth/signout?redirect_to=${encodeURIComponent("/")}`;
    } catch (error) {
      console.error("Sign out error:", error);
      setIsSigningOut(false);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-300 cursor-pointer transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-60"
    >
      {isSigningOut ? (
        "Signing out…"
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
          Sign out
        </>
      )}
    </motion.button>
  );
}
