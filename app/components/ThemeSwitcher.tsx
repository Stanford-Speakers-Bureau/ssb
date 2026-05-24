"use client";

import { useSyncExternalStore } from "react";

/**
 * Dev-only floating control to preview the 4 site themes. Sets a `theme-*` class
 * on <html> and persists the choice. Mounted only in development (see layout);
 * at finalize, the chosen theme becomes the default and this is removed.
 *
 * Reads the active theme straight off the <html> class via useSyncExternalStore
 * so there's no setState-in-effect and no hydration mismatch (the server snapshot
 * is always "editorial", matching the server-rendered default class).
 */
const THEMES = [
  { id: "editorial", label: "Editorial" },
  { id: "ember", label: "Ember" },
  { id: "press", label: "Press" },
  { id: "marquee", label: "Marquee" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "ssb-theme";
const EVENT = "ssb-theme-change";
const THEME_CLASSES = THEMES.map((t) => `theme-${t.id}`);

function isThemeId(v: string | undefined): v is ThemeId {
  return !!v && THEMES.some((t) => t.id === v);
}

function applyTheme(id: ThemeId) {
  const el = document.documentElement;
  el.classList.remove(...THEME_CLASSES);
  el.classList.add(`theme-${id}`);
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

function getSnapshot(): ThemeId {
  const cls = Array.from(document.documentElement.classList).find((c) =>
    c.startsWith("theme-"),
  );
  const id = cls?.slice("theme-".length);
  return isThemeId(id) ? id : "editorial";
}

function getServerSnapshot(): ThemeId {
  return "editorial";
}

export default function ThemeSwitcher() {
  const active = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const choose = (id: ThemeId) => {
    applyTheme(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/80 p-1 pl-3 shadow-2xl backdrop-blur-md">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-white/45">
        Theme
      </span>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => choose(t.id)}
          aria-pressed={active === t.id}
          className={
            active === t.id
              ? "rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-black"
              : "rounded-full px-3 py-1.5 text-sm font-medium text-white/70 hover:text-white"
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
