"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import BannerBar from "./BannerBar";
import EventPopup from "./EventPopup";

const BACKGROUND_REFRESH_MS = 10 * 60 * 1000;
const PHASE_TRANSITION_BUFFER_MS = 1_000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const BANNER_CACHE_KEY = "ssb:banner-data:v1";
const BANNER_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type BannerProps = {
  text: string;
  href: string;
  target?: string | number | Date | null;
  prefaceLabel: string;
  eventId?: string | null;
  imageUrl?: string | null;
  phase?: "mystery" | "pre-ticketing" | "ticketing-open";
  eventRoute?: string | null;
  speakerName?: string | null;
  isLoggedIn?: boolean;
  isNotified?: boolean;
};

type BannerData = {
  showBanner: boolean;
  bannerProps: BannerProps | null;
};

type CachedBanner = {
  data: BannerData;
  cachedAt: number;
};

function isValidBannerData(data: unknown): data is BannerData {
  if (!data || typeof data !== "object") return false;

  const candidate = data as Partial<BannerData>;
  if (typeof candidate.showBanner !== "boolean") return false;
  if (!candidate.showBanner) return candidate.bannerProps === null;

  const props = candidate.bannerProps;
  return (
    !!props &&
    typeof props === "object" &&
    typeof props.text === "string" &&
    typeof props.href === "string" &&
    props.href.startsWith("/") &&
    !props.href.startsWith("//") &&
    typeof props.prefaceLabel === "string"
  );
}

function parseCachedBanner(raw: string | null): CachedBanner | null {
  if (!raw) return null;
  try {
    const cached = JSON.parse(raw) as CachedBanner;
    if (
      !cached ||
      typeof cached.cachedAt !== "number" ||
      !isValidBannerData(cached.data)
    ) {
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function readCachedBanner(): CachedBanner | null {
  try {
    const cached = parseCachedBanner(
      window.localStorage.getItem(BANNER_CACHE_KEY),
    );
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > BANNER_CACHE_MAX_AGE_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCachedBanner(data: BannerData) {
  try {
    window.localStorage.setItem(
      BANNER_CACHE_KEY,
      JSON.stringify({ data, cachedAt: Date.now() } satisfies CachedBanner),
    );
  } catch {
    // localStorage may be unavailable.
  }
}

export default function ClientHeaderBar() {
  const pathname = usePathname();
  const isScanRoute = pathname.startsWith("/scan");
  const isEventRoute = pathname.startsWith("/events/");

  const [bannerData, setBannerData] = useState<BannerData | null>(null);
  const [hasFreshBannerData, setHasFreshBannerData] = useState(false);

  useEffect(() => {
    if (isScanRoute || isEventRoute) {
      return;
    }

    let isActive = true;
    let phaseTimeoutId: number | null = null;
    let refreshTimeoutId: number | null = null;
    let lastRefreshAt = 0;
    let inFlightController: AbortController | null = null;

    const clearPhaseRefresh = () => {
      if (phaseTimeoutId !== null) {
        window.clearTimeout(phaseTimeoutId);
        phaseTimeoutId = null;
      }
    };

    const clearNextRefresh = () => {
      if (refreshTimeoutId !== null) {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = null;
      }
    };

    const scheduleNextRefresh = (delayMs = BACKGROUND_REFRESH_MS) => {
      if (document.visibilityState !== "visible") return;

      clearNextRefresh();
      refreshTimeoutId = window.setTimeout(
        () => {
          refreshIfDue();
        },
        Math.min(Math.max(delayMs, 0), MAX_TIMEOUT_MS),
      );
    };

    const schedulePhaseRefresh = (target: BannerProps["target"]) => {
      clearPhaseRefresh();
      if (target == null) return;

      const targetMs = new Date(target).getTime();
      if (Number.isNaN(targetMs)) return;

      const delay = Math.max(
        targetMs - Date.now() + PHASE_TRANSITION_BUFFER_MS,
        PHASE_TRANSITION_BUFFER_MS,
      );

      phaseTimeoutId = window.setTimeout(
        () => {
          void refreshBanner();
          scheduleNextRefresh();
        },
        Math.min(delay, MAX_TIMEOUT_MS),
      );
    };

    async function refreshBanner() {
      if (inFlightController || document.visibilityState !== "visible") {
        return;
      }

      const controller = new AbortController();
      inFlightController = controller;
      lastRefreshAt = Date.now();

      try {
        const response = await fetch("/api/banner-data", {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = (await response.json()) as BannerData;
        if (!isActive) return;

        setBannerData(data);
        setHasFreshBannerData(true);
        writeCachedBanner(data);
        schedulePhaseRefresh(data.bannerProps?.target ?? null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch banner data:", error);
      } finally {
        if (inFlightController === controller) {
          inFlightController = null;
        }
      }
    }

    function refreshIfDue() {
      if (document.visibilityState !== "visible") return;

      const nextRefreshIn =
        lastRefreshAt === 0
          ? 0
          : BACKGROUND_REFRESH_MS - (Date.now() - lastRefreshAt);

      if (nextRefreshIn > 0) {
        scheduleNextRefresh(nextRefreshIn);
        return;
      }

      void refreshBanner();
      scheduleNextRefresh();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshIfDue();
      } else {
        clearNextRefresh();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (!isActive || event.key !== BANNER_CACHE_KEY) return;

      const cached = parseCachedBanner(event.newValue);
      if (!cached) return;

      setBannerData(cached.data);
      setHasFreshBannerData(true);
      lastRefreshAt = cached.cachedAt;
      schedulePhaseRefresh(cached.data.bannerProps?.target ?? null);
      scheduleNextRefresh();
    };

    void Promise.resolve().then(() => {
      if (!isActive) return;

      const cached = readCachedBanner();
      if (cached) {
        setBannerData(cached.data);
        setHasFreshBannerData(false);
        lastRefreshAt = cached.cachedAt;
        schedulePhaseRefresh(cached.data.bannerProps?.target ?? null);
      }

      refreshIfDue();
    });

    window.addEventListener("focus", refreshIfDue);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      inFlightController?.abort();
      clearPhaseRefresh();
      clearNextRefresh();
      window.removeEventListener("focus", refreshIfDue);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isEventRoute, isScanRoute]);

  if (isScanRoute) {
    return null;
  }

  if (isEventRoute) {
    return <NavBar banner={false} />;
  }

  if (!bannerData) {
    return (
      <>
        <div className="h-9 md:h-10" aria-hidden="true" />
        <NavBar banner={false} />
      </>
    );
  }

  const bp = bannerData.bannerProps;

  return (
    <>
      {bannerData.showBanner && bp && (
        <BannerBar
          text={bp.text}
          href={bp.href}
          target={bp.target ?? undefined}
          prefaceLabel={bp.prefaceLabel}
        />
      )}
      <NavBar banner={bannerData.showBanner} />
      {hasFreshBannerData &&
        bannerData.showBanner &&
        bp?.eventId &&
        bp.phase && (
          <EventPopup
            eventId={bp.eventId}
            text={bp.text}
            href={bp.href}
            target={typeof bp.target === "string" ? bp.target : null}
            prefaceLabel={bp.prefaceLabel}
            phase={bp.phase}
            imageUrl={bp.imageUrl ?? null}
            speakerName={bp.speakerName ?? null}
            isLoggedIn={bp.isLoggedIn ?? false}
            isNotified={bp.isNotified ?? false}
          />
        )}
    </>
  );
}
