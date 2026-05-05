import {
  heroOG,
  ogMosaicContentType,
  ogMosaicSize,
} from "@/app/lib/og-mosaic";

export const alt = "Meet the Team";
export const size = ogMosaicSize;
export const contentType = ogMosaicContentType;

export default async function Image() {
  return heroOG({ heroImage: "/og/team.jpg" });
}
