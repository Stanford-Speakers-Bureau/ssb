"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import BannerBar from "./BannerBar";
import EventPopup from "./EventPopup";

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
    async function fetchBannerData() {
      try {
        const response = await fetch("/api/banner-data");
        if (response.ok) {
          const data = (await response.json()) as BannerData;
          setBannerData(data);
        }
      } catch (error) {
        console.error("Failed to fetch banner data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBannerData();

    // Refresh banner data every minute
    const interval = setInterval(fetchBannerData, 60000);
    return () => clearInterval(interval);
  }, []);

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
          eventRoute={bp.eventRoute ?? null}
        />
      )}
    </>
  );
}
