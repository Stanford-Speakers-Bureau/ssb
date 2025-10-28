"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  
  const logoClasses = isHomePage 
    ? "text-xl font-bold text-white"
    : "text-xl font-bold text-black dark:text-white";
  
  const linkClasses = isHomePage
    ? "text-sm font-medium text-white transition-colors hover:text-white/80"
    : "text-sm font-medium text-black dark:text-gray-300 transition-colors hover:text-black dark:hover:text-white";
  
  return (
    <nav className="absolute top-0 left-0 right-0 z-50 w-full">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
        <div className="flex items-center gap-8 pt-2">
          <a href="/" className={logoClasses}>
            Logo
          </a>
          <div className="hidden items-center gap-6 md:flex">
            <motion.a 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="/past-speakers" 
              className={linkClasses}
            >
              Past Speakers
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="/co-sponsorships" 
              className={linkClasses}
            >
              Co-Sponsorships
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="/team" 
              className={linkClasses}
            >
              Team
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="/contact" 
              className={linkClasses}
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
            className="rounded-full px-4 py-2 text-sm font-medium text-white bg-[#d43d3d] shadow transition-colors hover:bg-[#b32f2f]"
          >
            Sign In
          </motion.a>
        </div>
      </div>
    </nav>
  );
}

