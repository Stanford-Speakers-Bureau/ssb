import {
  mosaicOG,
  ogMosaicContentType,
  ogMosaicSize,
} from "@/app/lib/og-mosaic";

export const alt = "Join SSB";
export const size = ogMosaicSize;
export const contentType = ogMosaicContentType;

export default async function Image() {
  return mosaicOG({ title: "Join SSB" });
}
