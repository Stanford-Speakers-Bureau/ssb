"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  SignalIcon,
} from "@heroicons/react/16/solid";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEventContext } from "./EventContext";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  group: "top" | "events" | "analytics" | "admin";
};

type AdminLayoutClientProps = {
  children: React.ReactNode;
  navItems: NavItem[];
  emailDisabled: boolean;
  hasLiveEvent: boolean;
};

/** Event-scoped base paths (longest first for matching). */
const EVENT_SCOPED_PATHS = [
  "/events/edit",
  "/notify-analytics",
  "/feedback-analytics",
  "/sales",
  "/check-in",
  "/summary",
  "/tickets",
  "/waitlist",
  "/referrals",
  "/notify",
  "/audience",
  "/event-questions",
];

function isEventScoped(href: string): boolean {
  return EVENT_SCOPED_PATHS.includes(href);
}

export default function AdminLayoutClient({
  children,
  navItems,
  emailDisabled,
  hasLiveEvent,
}: AdminLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { events, selectedEventId, setSelectedEventId } = useEventContext();
  const [isPending, startTransition] = useTransition();
  // Optimistic selection so the dropdown reflects the user's pick instantly
  // while the route transition is in flight (the URL is the source of truth).
  // We only honor it while pending; once navigation settles, the committed
  // route (synced into context by EventSync) drives the value again.
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const displayedEventId =
    isPending && pendingEventId ? pendingEventId : selectedEventId;

  const topItems = navItems.filter((i) => i.group === "top");
  const eventItems = navItems.filter((i) => i.group === "events");
  const analyticsItems = navItems.filter((i) => i.group === "analytics");
  const adminItems = navItems.filter((i) => i.group === "admin");

  function handleEventChange(newEventId: string) {
    // On an event-scoped page the URL is the single source of truth: navigate
    // only and let EventSync write context when the route commits. Writing
    // context here as well would create a second writer that races navigation.
    const currentSection = newEventId
      ? EVENT_SCOPED_PATHS.find(
          (p) => pathname === p || pathname.startsWith(p + "/"),
        )
      : undefined;

    if (currentSection && newEventId) {
      setPendingEventId(newEventId);
      startTransition(() => {
        router.push(`${currentSection}/${newEventId}`);
      });
      return;
    }

    // Non-scoped page (or cleared selection): just update the remembered
    // selection used to build event-scoped nav links.
    setSelectedEventId(newEventId);
  }

  function navHref(item: { href: string }): string {
    if (isEventScoped(item.href) && selectedEventId) {
      return `${item.href}/${selectedEventId}`;
    }
    return item.href;
  }

  function isNavActive(item: { href: string }): boolean {
    if (isEventScoped(item.href)) {
      return pathname === item.href || pathname.startsWith(item.href + "/");
    }
    return pathname === item.href;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Desktop Sidebar — lg+ full, md icons-only */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 z-50 flex-col bg-zinc-900 border-r border-white/10 md:w-16 lg:w-64 transition-all">
        {/* Live event left stripe */}
        {hasLiveEvent && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 z-10" />
        )}

        {/* Branding */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-white/10 shrink-0">
          <img
            src="/favicon.ico"
            alt="SSB"
            className="w-8 h-8 rounded shrink-0"
          />
          <span className="text-white font-bold text-lg font-serif hidden lg:block">
            SSB Admin
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2 space-y-1">
          {topItems.map((item) => {
            const active = isNavActive(item);
            return (
              <Link
                key={item.href}
                href={navHref(item)}
                prefetch={false}
                title={item.label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-rose-500/10 text-rose-400"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={item.icon}
                  />
                </svg>
                <span className="hidden lg:block">{item.label}</span>
              </Link>
            );
          })}

          <div className="my-3 border-t border-white/10" />

          <span className="hidden lg:block px-3 pb-1 text-xs font-semibold text-zinc-500 tracking-wide">
            Events
          </span>
          {eventItems.map((item) => {
            const active = isNavActive(item);
            return (
              <Link
                key={item.href}
                href={navHref(item)}
                prefetch={false}
                title={item.label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-rose-500/10 text-rose-400"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={item.icon}
                  />
                </svg>
                <span className="hidden lg:block">{item.label}</span>
              </Link>
            );
          })}

          <div className="my-3 border-t border-white/10" />

          <span className="hidden lg:block px-3 pb-1 text-xs font-semibold text-zinc-500 tracking-wide">
            Analytics
          </span>
          {analyticsItems.map((item) => {
            const active = isNavActive(item);
            return (
              <Link
                key={item.href}
                href={navHref(item)}
                prefetch={false}
                title={item.label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-rose-500/10 text-rose-400"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={item.icon}
                  />
                </svg>
                <span className="hidden lg:block">{item.label}</span>
              </Link>
            );
          })}

          <div className="my-3 border-t border-white/10" />

          <span className="hidden lg:block px-3 pb-1 text-xs font-semibold text-zinc-500 tracking-wide">
            Admin
          </span>
          {adminItems.map((item) => {
            const active = isNavActive(item);
            return (
              <Link
                key={item.href}
                href={navHref(item)}
                prefetch={false}
                title={item.label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-rose-500/10 text-rose-400"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={item.icon}
                  />
                </svg>
                <span className="hidden lg:block">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Event selector */}
        <div className="px-2 py-3 border-t border-white/10">
          {/* Full dropdown on lg+ */}
          <div className="hidden lg:block">
            <label className="block px-3 pb-1 text-xs font-semibold text-zinc-500 tracking-wide">
              Event
            </label>
            <select
              aria-label="Selected event"
              value={displayedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 rounded-lg text-white text-sm ring-1 ring-inset ring-white/10 focus:outline-none focus:ring-rose-500/50"
            >
              <option value="">Select event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name || "Unnamed Event"}
                </option>
              ))}
            </select>
          </div>
          {/* Icon-only trigger on md */}
          <div className="lg:hidden relative group">
            <div className="flex items-center justify-center">
              <CalendarIcon className="size-4 shrink-0 text-zinc-400 w-5 h-5" aria-hidden="true" />
            </div>
            {/* Tooltip-style dropdown on hover */}
            <div className="absolute left-full top-0 bottom-0 hidden group-hover:block z-50 pl-2">
              <div className="bg-zinc-800 ring-1 ring-inset ring-white/10 rounded-lg shadow-xl p-2 min-w-[200px]">
                <p className="px-2 pb-1 text-xs font-semibold text-zinc-500 tracking-wide">
                  Event
                </p>
                <select
                  aria-label="Selected event"
                  value={displayedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white/5 ring-1 ring-inset ring-white/10 rounded text-white text-sm focus:outline-none"
                >
                  <option value="">Select event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name || "Unnamed Event"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Exit link */}
        <div className="px-2 pb-4 border-t border-white/10 pt-3">
          <Link
            href="https://stanfordspeakersbureau.com"
            prefetch={false}
            title="Exit to main site"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeftIcon className="size-4 shrink-0 w-5 h-5" aria-hidden="true" />
            <span className="hidden lg:block">Exit</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Event Selector */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-2 px-3 py-2">
          <CalendarIcon className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
          <select
            aria-label="Selected event"
            value={displayedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="flex-1 min-w-0 bg-white/5 ring-1 ring-inset ring-white/10 rounded-md px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-rose-500/50 truncate"
          >
            <option value="">Select event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name || "Unnamed Event"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 z-50">
        <div className="h-full flex items-center gap-1 px-2 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const active = isNavActive(item);
            return (
              <Link
                key={item.href}
                href={navHref(item)}
                prefetch={false}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded transition-all shrink-0 ${
                  active ? "text-rose-400" : "text-zinc-500 hover:text-white"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={item.icon}
                  />
                </svg>
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Global Live Event Indicator */}
      {hasLiveEvent && (
        <div className="fixed top-12 md:top-0 left-0 right-0 md:left-16 lg:left-64 z-[100] flex justify-center pointer-events-none">
          <div className="bg-red-700 px-4 py-1 rounded-b-md flex items-center gap-2">
            <SignalIcon className="size-4 shrink-0 text-white" aria-hidden="true" />
            <p className="text-white text-sm font-bold">EVENT LIVE</p>
          </div>
        </div>
      )}

      {/* Global Email Disabled Banner */}
      {emailDisabled && (
        <div className="fixed top-12 md:top-0 left-0 right-0 md:left-16 lg:left-64 z-40 bg-amber-500/10 border-b border-amber-500/30 backdrop-blur-sm">
          <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
            <ExclamationTriangleIcon className="size-4 shrink-0 text-amber-400 w-5 h-5" aria-hidden="true" />
            <p className="text-amber-400 text-sm font-medium">
              EMAIL SENDING DISABLED
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main
        className={`pb-20 md:pb-8 min-h-screen pt-12 md:pt-0 md:ml-16 lg:ml-64 ${
          emailDisabled ? "md:pt-12" : ""
        }`}
      >
        {children}
      </main>
    </div>
  );
}
