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
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="rounded px-4 py-2 text-base font-semibold text-white shadow-lg bg-[#A80D0C] cursor-pointer transition-colors hover:bg-[#C11211]"
    >
      {isSigningOut ? "Signing out..." : "Sign Out"}
    </motion.button>
  );
}
