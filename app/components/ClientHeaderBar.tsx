"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import BannerBar from "./BannerBar";

type BannerProps = {
  text: string;
  href: string;
  target?: string | number | Date | null;
  prefaceLabel: string;
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

  return (
    <>
      {bannerData.showBanner && bannerData.bannerProps && (
        <BannerBar
          text={bannerData.bannerProps.text}
          href={bannerData.bannerProps.href}
          target={bannerData.bannerProps.target ?? undefined}
          prefaceLabel={bannerData.bannerProps.prefaceLabel}
        />
      )}
      <NavBar banner={bannerData.showBanner} />
    </>
  );
}
