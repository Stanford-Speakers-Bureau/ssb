import {
  heroOG,
  ogMosaicContentType,
  ogMosaicSize,
} from "@/app/lib/og-mosaic";

export const alt = "Get in Touch with SSB";
export const size = ogMosaicSize;
export const contentType = ogMosaicContentType;

export default async function Image() {
  return heroOG({ heroImage: "/og/students.jpg" });
}
