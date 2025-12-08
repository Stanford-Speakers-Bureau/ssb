"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import BannerBar from "./BannerBar";

type BannerProps = {
  text: string;
  href: string;
  target?: string | number | Date | null;
  prefaceLabel: string;
};

interface SiteChromeProps {
  showBanner: boolean;
  bannerProps: BannerProps;
}

export default function SiteChrome({
  showBanner,
  bannerProps,
}: SiteChromeProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");

  if (isAdminRoute) {
    return null;
  }

  return (
    <>
      {showBanner && (
        <BannerBar
          text={bannerProps.text}
          href={bannerProps.href}
          target={bannerProps.target ?? undefined}
          prefaceLabel={bannerProps.prefaceLabel}
        />
      )}
      <NavBar banner={showBanner} />
    </>
  );
}
