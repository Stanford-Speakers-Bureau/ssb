"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ClientFooter() {
  const pathname = usePathname();
  const isScanRoute = pathname.startsWith("/scan");

  if (isScanRoute) {
    return null;
  }

  return <Footer />;
}
