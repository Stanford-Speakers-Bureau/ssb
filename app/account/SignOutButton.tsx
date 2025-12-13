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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="rounded px-4 py-2 text-sm font-semibold text-white bg-[#A80D0C] transition-colors hover:bg-[#C11211] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isSigningOut ? "Signing out..." : "Sign Out"}
    </motion.button>
  );
}
