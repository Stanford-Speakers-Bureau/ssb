import type { Metadata } from "next";
import QRGeneratorClient from "./QRGeneratorClient";

const ogTitle = "QR Code Generator";
const ogDescription =
  "Generate a QR code for any link, with the SSB logo in the center.";

export const metadata: Metadata = {
  title: "QR Code Generator",
  description: ogDescription,
  openGraph: { title: ogTitle, description: ogDescription },
  twitter: { title: ogTitle, description: ogDescription },
  robots: { index: false, follow: false },
};

export default function QRPage() {
  return <QRGeneratorClient />;
}
