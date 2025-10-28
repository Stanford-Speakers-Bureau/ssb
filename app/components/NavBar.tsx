"use client";

import { motion } from "motion/react";

interface NavBarProps {
  overlay?: boolean;
}

export default function NavBar({ overlay = false }: NavBarProps) {
  if (overlay) {
    return (
      <nav className="absolute top-0 left-0 right-0 z-50 w-full bg-gradient-to-b from-black/50 to-transparent">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
          <div className="flex items-center gap-8 pt-2">
            <a href="/" className="text-xl font-bold text-white drop-shadow-lg">
              Logo
            </a>
            <div className="hidden items-center gap-6 md:flex">
              <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="/past-speakers" className="text-sm font-medium text-white/90 transition-colors hover:text-white drop-shadow">
                Past Speakers
              </motion.a>
              <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="/co-sponsorships" className="text-sm font-medium text-white/90 transition-colors hover:text-white drop-shadow">
                Co-Sponsorships
              </motion.a>
              <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="/team" className="text-sm font-medium text-white/90 transition-colors hover:text-white drop-shadow">
                Team
              </motion.a>
              <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="/contact" className="text-sm font-medium text-white/90 transition-colors hover:text-white drop-shadow">
                Contact
              </motion.a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href="/sign-in" className="rounded-full px-4 py-2 text-sm font-medium bg-white text-black">
              Sign In
            </motion.a>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-full bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
        <div className="flex items-center gap-8">
          <a href="/" className="text-xl font-bold text-black dark:text-white">
            Logo
          </a>
          <div className="hidden items-center gap-6 md:flex">
            <motion.a 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="/past-speakers" 
              className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-black dark:hover:text-white"
            >
              Past Speakers
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="/co-sponsorships" 
              className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-black dark:hover:text-white"
            >
              Co-Sponsorships
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="/team" 
              className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-black dark:hover:text-white"
            >
              Team
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="/contact" 
              className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-black dark:hover:text-white"
            >
              Contact
            </motion.a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <motion.a 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }} 
            href="/sign-in" 
            className="rounded-full px-4 py-2 text-sm font-medium bg-black dark:bg-white text-white dark:text-black"
          >
            Sign In
          </motion.a>
        </div>
      </div>
    </nav>
  );
}

