"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import BannerBar from "./BannerBar";
import EventPopup from "./EventPopup";

const BACKGROUND_REFRESH_MS = 10 * 60 * 1000;
const PHASE_TRANSITION_BUFFER_MS = 1_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

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

export default function ClientHeaderBar() {
  const pathname = usePathname();
  const isScanRoute = pathname.startsWith("/scan");
  const isEventRoute = pathname.startsWith("/events/");

  const [bannerData, setBannerData] = useState<BannerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isScanRoute || isEventRoute) {
      setBannerData(null);
      setLoading(false);
      return;
    }

    let isActive = true;
    let phaseTimeoutId: number | null = null;
    let lastVisibilityRefreshAt = 0;
    let inFlightController: AbortController | null = null;

    const clearPhaseTimeout = () => {
      if (phaseTimeoutId !== null) {
        window.clearTimeout(phaseTimeoutId);
        phaseTimeoutId = null;
      }
    };

    const schedulePhaseRefresh = (target: BannerProps["target"]) => {
      clearPhaseTimeout();

      if (target == null) {
        return;
      }

      const targetMs = new Date(target).getTime();
      if (Number.isNaN(targetMs)) {
        return;
      }

      const delay = Math.max(
        targetMs - Date.now() + PHASE_TRANSITION_BUFFER_MS,
        PHASE_TRANSITION_BUFFER_MS,
      );

      phaseTimeoutId = window.setTimeout(() => {
        void fetchBannerData();
      }, Math.min(delay, MAX_TIMEOUT_MS));
    };

    async function fetchBannerData() {
      inFlightController?.abort();
      const controller = new AbortController();
      inFlightController = controller;

      try {
        const response = await fetch("/api/banner-data", {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as BannerData;
          if (!isActive) {
            return;
          }
          setBannerData(data);
          schedulePhaseRefresh(data.bannerProps?.target ?? null);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch banner data:", error);
      } finally {
        if (isActive && inFlightController === controller) {
          setLoading(false);
        }
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const now = Date.now();
      if (now - lastVisibilityRefreshAt < 5_000) {
        return;
      }

      lastVisibilityRefreshAt = now;
      void fetchBannerData();
    };

    setLoading(true);
    void fetchBannerData();

    const interval = window.setInterval(() => {
      void fetchBannerData();
    }, BACKGROUND_REFRESH_MS);

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      isActive = false;
      inFlightController?.abort();
      clearPhaseTimeout();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isEventRoute, isScanRoute]);

  if (isScanRoute) {
    return null;
  }

  if (isEventRoute) {
    return <NavBar banner={false} />;
  }

  // Show loading state or nothing while fetching
  if (loading || !bannerData) {
    return <NavBar banner={false} />;
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
      {bannerData.showBanner && bp?.eventId && bp.phase && (
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
