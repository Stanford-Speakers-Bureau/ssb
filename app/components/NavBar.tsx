"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const AUTH_CACHE_KEY = "ssb_nav_auth";
const AUTH_CACHE_TTL_MS = 60_000;
const NAV_ITEMS = [
  { href: "/upcoming-speakers", label: "Upcoming Speakers" },
  { href: "/past-speakers", label: "Past Speakers" },
  { href: "/suggest", label: "Suggest" },
  { href: "/event-sponsorship", label: "Event Sponsorship" },
  { href: "/team", label: "Team" },
  { href: "/contact", label: "Contact" },
] as const;

function isNavItemActive(pathname: string, href: string) {
  if (href === "/upcoming-speakers") {
    return pathname === href || pathname.startsWith("/events/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readCachedAuthState(): boolean | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = window.sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as {
      authenticated?: boolean;
      expiresAt?: number;
    };

    if (
      typeof parsed.authenticated !== "boolean" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      window.sessionStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }

    return parsed.authenticated;
  } catch {
    return null;
  }
}

function writeCachedAuthState(authenticated: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      AUTH_CACHE_KEY,
      JSON.stringify({
        authenticated,
        expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
      }),
    );
  } catch {
    // Ignore storage failures.
  }
}

export default function NavBar({ banner }: { banner: boolean }) {
  const pathname = usePathname();
  const isOverlayNavPage =
    pathname === "/" ||
    pathname === "/contact" ||
    pathname === "/team" ||
    pathname === "/suggest" ||
    pathname === "/past-speakers" ||
    pathname === "/event-sponsorship" ||
    pathname.startsWith("/events/");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() =>
    readCachedAuthState(),
  );

  // Check authentication state
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { authenticated: boolean };
        if (!cancelled) {
          setIsAuthenticated(data.authenticated);
          writeCachedAuthState(data.authenticated);
        }
      } catch (error) {
        console.error("Failed to check auth state:", error);
        if (!cancelled) {
          setIsAuthenticated(false);
          writeCachedAuthState(false);
        }
      }
    };

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const glassClasses = isOverlayNavPage
    ? "border-white/16 bg-[rgba(24,19,17,0.38)] shadow-[0_22px_60px_rgba(0,0,0,0.24)]"
    : "border-white/10 bg-[rgba(18,14,13,0.88)] shadow-[0_18px_50px_rgba(0,0,0,0.2)]";

  const logoClasses = "text-xl font-bold text-white";

  const mobileMenuBgClasses =
    "border-l border-white/10 bg-[rgba(19,15,14,0.94)] text-white backdrop-blur-2xl";

  const hamburgerClasses = "text-white";

  const accountClasses =
    "rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/18";
  const mobileAccountClasses =
    "mt-4 rounded-full bg-white/12 px-4 py-3 text-lg font-semibold text-white transition-colors hover:bg-white/18";

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
      <nav className="sticky top-0 left-0 right-0 z-50 w-full h-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 sm:px-12 md:px-16">
          <div
            className={`absolute left-4 right-4 top-4 flex h-[64px] flex-1 items-center gap-6 rounded-full border px-4 pb-0.5 backdrop-blur-xl sm:left-6 sm:right-6 sm:px-6 lg:left-auto lg:right-auto lg:w-full lg:max-w-5xl lg:px-5 ${glassClasses} ${mobileMenuOpen ? "z-0" : "z-10"}`}
          >
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="hidden lg:block"
            >
              <Link href="/" className={logoClasses} prefetch={false}>
                <Image
                  src="/logo.png"
                  alt="Stanford Speakers Bureau (SSB) Logo"
                  width={36}
                  height={36}
                />
              </Link>
            </motion.div>
            <div className="hidden flex-1 items-center justify-center gap-1 lg:flex">
              {NAV_ITEMS.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                const navItemClasses = active
                  ? "bg-white/14 text-white"
                  : "text-white/84 hover:bg-white/10 hover:text-white";

                return (
                  <motion.div
                    key={item.href}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link
                      href={item.href}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${navItemClasses}`}
                      prefetch={false}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="ml-auto"
              >
                {isAuthenticated === null ? (
                  <span
                    className={`${accountClasses} pointer-events-none opacity-70`}
                    aria-hidden="true"
                  >
                    Account
                  </span>
                ) : isAuthenticated ? (
                  <Link href="/account" className={accountClasses}>
                    Account
                  </Link>
                ) : (
                  <Link
                    href={`/api/auth/login?redirect_to=${encodeURIComponent(pathname)}`}
                    className={accountClasses}
                  >
                    Sign In
                  </Link>
                )}
              </motion.div>
            </div>
          </div>

          {/* Mobile Logo - positioned outside frosted div to stay above menu */}
          <div className="absolute left-8 top-[31px] z-30 lg:hidden sm:left-10">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/"
                className={logoClasses}
                prefetch={false}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Image
                  src="/logo.png"
                  alt="Stanford Speakers Bureau (SSB) Logo"
                  width={36}
                  height={36}
                />
              </Link>
            </motion.div>
          </div>

          {/* Mobile Menu Button - positioned outside frosted div to stay above menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`absolute right-4 top-[25px] z-30 rounded-full bg-white/10 p-2.5 transition-colors hover:bg-white/16 lg:hidden sm:right-8 ${hamburgerClasses}`}
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

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className={`fixed inset-y-0 right-0 z-20 w-full shadow-2xl lg:hidden sm:w-80 ${mobileMenuBgClasses}`}
            >
              <div
                className={`flex h-full flex-col px-5 sm:px-8 ${banner ? "pt-30" : "pt-20"}`}
              >
                <div className="flex flex-col space-y-2">
                  {NAV_ITEMS.map((item) => {
                    const active = isNavItemActive(pathname, item.href);
                    const mobileLinkClasses = active
                      ? "bg-white/12 text-white"
                      : "text-white/88 hover:bg-white/8 hover:text-white";

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-2xl px-4 py-3 text-lg font-medium transition-colors ${mobileLinkClasses}`}
                        prefetch={false}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                  {isAuthenticated !== null &&
                    (isAuthenticated ? (
                      <Link
                        href="/account"
                        className={mobileAccountClasses}
                        prefetch={false}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Account
                      </Link>
                    ) : (
                      <Link
                        href={`/api/auth/login?redirect_to=${encodeURIComponent(pathname)}`}
                        className={mobileAccountClasses}
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
      </nav>
    </>
  );
}
