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

interface HeaderBarProps {
  showBanner: boolean;
  bannerProps: BannerProps;
}

export default function HeaderBar({ showBanner, bannerProps }: HeaderBarProps) {
  const pathname = usePathname();
  const isScanRoute = pathname.startsWith("/scan");
  const isEventRoute = pathname.startsWith("/events/");

  if (isScanRoute) {
    return null;
  }

  if (isEventRoute) {
    return <NavBar banner={false} />;
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
