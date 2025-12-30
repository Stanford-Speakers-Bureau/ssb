"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function NavBar({ banner }: { banner: boolean }) {
  const pathname = usePathname();
  const isWhiteNavPage = pathname === "/" || pathname === "/contact";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
      } catch (error) {
        console.error("Failed to check auth state:", error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, [pathname]);

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
      <nav
        className={`absolute ${banner ? "top-10" : "top-0"} left-0 right-0 z-50 w-full`}
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-8 sm:px-12 md:px-16">
          <div className="flex items-center gap-8 pt-2 flex-1">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link href="/" className={logoClasses} prefetch={false}>
                <Image
                  src="/logo.png"
                  alt="Stanford Speakers Bureau (SSB) Logo"
                  width={40}
                  height={40}
                />
              </Link>
            </motion.div>
            <div className="hidden items-center gap-6 md:flex flex-1">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  href="/upcoming-speakers"
                  className={linkClasses}
                  prefetch={false}
                >
                  Upcoming Speakers
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  href="/past-speakers"
                  className={linkClasses}
                  prefetch={false}
                >
                  Past Speakers
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link href="/suggest" className={linkClasses} prefetch={false}>
                  Suggest
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  href="/event-sponsorship"
                  className={linkClasses}
                  prefetch={false}
                >
                  Event Sponsorship
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link href="/team" className={linkClasses} prefetch={false}>
                  Team
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link href="/contact" className={linkClasses} prefetch={false}>
                  Contact
                </Link>
              </motion.div>
              {/*{isAuthenticated !== null && (*/}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="ml-auto"
                >
                  {isAuthenticated == null || isAuthenticated ? (
                    <Link href="/account" className={linkClasses}>
                      Account
                    </Link>
                  ) : (
                    <Link
                      href={`/api/auth/google?redirect_to=${encodeURIComponent(pathname)}`}
                      className={linkClasses}
                    >
                      Sign In
                    </Link>
                  )}
                </motion.div>
              {/*)}*/}
            </div>
          </div>
          <div className="flex items-center gap-4">
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
            <div
              className={`flex flex-col h-full ${banner ? "pt-30" : "pt-20"} px-8`}
            >
              <div className="flex flex-col space-y-1">
                <Link
                  href="/upcoming-speakers"
                  className={mobileLinkClasses}
                  prefetch={false}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Upcoming Speakers
                </Link>
                <Link
                  href="/past-speakers"
                  className={mobileLinkClasses}
                  prefetch={false}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Past Speakers
                </Link>
                <Link
                  href="/suggest"
                  className={mobileLinkClasses}
                  prefetch={false}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Suggest
                </Link>
                <Link
                  href="/event-sponsorship"
                  className={mobileLinkClasses}
                  prefetch={false}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Event Sponsorship
                </Link>
                <Link
                  href="/team"
                  className={mobileLinkClasses}
                  prefetch={false}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Team
                </Link>
                <Link
                  href="/contact"
                  className={mobileLinkClasses}
                  prefetch={false}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact
                </Link>
                {isAuthenticated !== null &&
                  (isAuthenticated ? (
                    <Link
                      href="/account"
                      className={mobileLinkClasses}
                      prefetch={false}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Account
                    </Link>
                  ) : (
                    <Link
                      href={`/api/auth/google?redirect_to=${encodeURIComponent(pathname)}`}
                      className={mobileLinkClasses}
                      prefetch={false}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
