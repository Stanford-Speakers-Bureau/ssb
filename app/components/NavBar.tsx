"use client";

import { motion, AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";

export default function NavBar({ banner }: { banner: boolean }) {
  const pathname = usePathname();
  const isWhiteNavPage = pathname === "/" || pathname === "/contact";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const logoClasses = isWhiteNavPage 
    ? "text-xl font-bold text-white"
    : "text-xl font-bold text-black dark:text-white";
  
  const linkClasses = isWhiteNavPage
    ? "text-sm font-medium text-white transition-colors hover:text-white/80"
    : "text-sm font-medium text-black dark:text-gray-300 transition-colors hover:text-black dark:hover:text-white";
  
  const mobileMenuBgClasses = isWhiteNavPage
    ? "bg-black/95 backdrop-blur-sm"
    : "bg-white dark:bg-zinc-900";
  
  const mobileLinkClasses = isWhiteNavPage
    ? "text-lg font-medium text-white transition-colors hover:text-white/80 py-3"
    : "text-lg font-medium text-black dark:text-gray-300 transition-colors hover:text-[#A80D0C] py-3";
  
  const hamburgerClasses = isWhiteNavPage
    ? "text-white"
    : "text-black dark:text-white";
  
  // Disable body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    
    // Cleanup: restore scroll when component unmounts
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);
  
  return (
    <>
      <nav className={`absolute ${banner ? "top-10" : "top-0"} left-0 right-0 z-50 w-full`}>
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-8 sm:px-12 md:px-16">
          <div className="flex items-center gap-8 pt-2">
            <motion.a 
              href="/" 
              className={logoClasses}
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
            >
              <Image src="/logo.png" alt="Logo" width={40} height={40} />
            </motion.a>
            <div className="hidden items-center gap-6 md:flex">
              <motion.a 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }} 
                href="/upcoming-speakers" 
                className={linkClasses}
              >
                Upcoming Speakers
              </motion.a>
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
                href="/other-programs" 
                className={linkClasses}
              >
                Other Programs
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
            {/* <motion.a 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="/sign-in" 
              className="hidden sm:block rounded px-4 py-2 text-sm font-medium text-white bg-[#A80D0C] shadow transition-colors hover:bg-[#A80D0C]"
            >
              Sign In
            </motion.a> */}
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`md:hidden p-2 ${hamburgerClasses}`}
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className={`fixed inset-y-0 right-0 z-40 w-full sm:w-80 ${mobileMenuBgClasses} shadow-2xl md:hidden`}
          >
            <div className={`flex flex-col h-full ${banner ? "pt-30" : "pt-20"} px-8`}>
              <div className="flex flex-col space-y-1">
                <a
                  href="/upcoming-speakers"
                  className={mobileLinkClasses}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Upcoming Speakers
                </a>
                <a
                  href="/past-speakers"
                  className={mobileLinkClasses}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Past Speakers
                </a>
                <a
                  href="/other-programs"
                  className={mobileLinkClasses}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Other Programs
                </a>
                <a
                  href="/team"
                  className={mobileLinkClasses}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Team
                </a>
                <a
                  href="/contact"
                  className={mobileLinkClasses}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact
                </a>
                {/* <div className="pt-4 border-t border-gray-300 dark:border-gray-700">
                  <a
                    href="/sign-in"
                    className="block text-center rounded px-4 py-2 text-sm font-medium text-white bg-[#A80D0C] shadow transition-colors hover:bg-[#A80D0C]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </a>
                </div> */}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

