import {
  heroOG,
  ogMosaicContentType,
  ogMosaicSize,
} from "@/app/lib/og-mosaic";

export const alt = "Partner with SSB";
export const size = ogMosaicSize;
export const contentType = ogMosaicContentType;

export default async function Image() {
  return heroOG({ heroImage: "/og/meeting.jpg" });
}
