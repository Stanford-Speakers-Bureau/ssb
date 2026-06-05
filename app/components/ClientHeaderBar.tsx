"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import BannerBar from "./BannerBar";
import EventPopup from "./EventPopup";
import type { BannerProps, BannerData } from "../lib/banner";

const BACKGROUND_REFRESH_MS = 60 * 1000;
const PHASE_TRANSITION_BUFFER_MS = 1_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

export default function ClientHeaderBar({
  initialBannerData,
}: {
  initialBannerData: BannerData;
}) {
  const pathname = usePathname();
  const isScanRoute = pathname.startsWith("/scan");
  const isEventRoute = pathname.startsWith("/events/");

  const [bannerData, setBannerData] = useState<BannerData>(initialBannerData);

  useEffect(() => {
    if (isScanRoute) {
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
          void refreshBanner({ fresh: true });
          scheduleNextRefresh();
        },
        Math.min(delay, MAX_TIMEOUT_MS),
      );
    };

    async function refreshBanner({ fresh = false }: { fresh?: boolean } = {}) {
      if (inFlightController || document.visibilityState !== "visible") {
        return;
      }

      const controller = new AbortController();
      inFlightController = controller;
      lastRefreshAt = Date.now();

      try {
        const response = await fetch(
          fresh ? "/api/banner-data?fresh=1" : "/api/banner-data",
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) return;

        const data = (await response.json()) as BannerData;
        if (!isActive) return;

        setBannerData(data);
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

    refreshIfDue();

    window.addEventListener("focus", refreshIfDue);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      inFlightController?.abort();
      clearPhaseRefresh();
      clearNextRefresh();
      window.removeEventListener("focus", refreshIfDue);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isScanRoute]);

  if (isScanRoute) {
    return null;
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
      {/* Banner shows on event pages, but the popup modal does not: a ticket
          holder landing on an event page should not get a modal over it. */}
      {!isEventRoute && bannerData.showBanner && bp?.eventId && bp.phase && (
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
