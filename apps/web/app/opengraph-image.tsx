import {
  mosaicOG,
  ogMosaicContentType,
  ogMosaicSize,
} from "@/app/lib/og-mosaic";

export const alt = "Stanford Speakers Bureau";
export const size = ogMosaicSize;
export const contentType = ogMosaicContentType;

export default async function Image() {
  return mosaicOG();
}
