import {
  mosaicOG,
  ogMosaicContentType,
  ogMosaicSize,
} from "@/app/lib/og-mosaic";

export const alt = "Upcoming at Stanford";
export const size = ogMosaicSize;
export const contentType = ogMosaicContentType;

export default async function Image() {
  return mosaicOG({ title: "Upcoming at Stanford" });
}
