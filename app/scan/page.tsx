import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdminOrScannerRequest } from "@/app/lib/auth";
import ScanClient from "./ScanClient";

export const metadata: Metadata = {
  title: "Scanner",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const auth = await verifyAdminOrScannerRequest();

  if (!auth.authorized) {
    if (auth.error === "Not authenticated") {
      redirect(`/api/auth/login?redirect_to=${encodeURIComponent("/scan")}`);
    }

    redirect(`/`);
  }

  return <ScanClient />;
}
