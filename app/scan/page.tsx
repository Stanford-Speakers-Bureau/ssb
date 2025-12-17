import { redirect } from "next/navigation";
import { verifyAdminOrScannerRequest } from "@/app/lib/supabase";
import ScanClient from "./ScanClient";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const auth = await verifyAdminOrScannerRequest();

  if (!auth.authorized) {
    if (auth.error === "Not authenticated") {
      redirect(`/api/auth/google?redirect_to=${encodeURIComponent("/scan")}`);
    }

    redirect(`/`);
  }

  return <ScanClient />;
}
