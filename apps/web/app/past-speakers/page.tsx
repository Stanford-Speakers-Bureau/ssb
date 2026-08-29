import type { Metadata } from "next";
import PastSpeakersClient from "./PastSpeakersClient";
import { SPEAKERS } from "@/app/config/speakers";
import { truncate } from "@/app/lib/metadata";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const ARCHIVE_OG_TITLE = "The Archive";
const ARCHIVE_OG_DESCRIPTION =
  "A living record of the voices who have stood on Stanford's stage since 1935.";

type PageProps = {
  searchParams: Promise<{ speaker?: string | string[] }>;
};

// `/past-speakers?speaker=<slug>` is deeplinkable to an individual speaker (the
// drawer is opened client-side). Generate per-speaker Open Graph metadata so a
// shared link previews that speaker — their photo, role, date/venue, and bio —
// instead of the generic archive card. The matching image is produced by the
// route handler at /past-speakers/og.
export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const slug = Array.isArray(sp.speaker) ? sp.speaker[0] : sp.speaker;
  const speaker = slug ? SPEAKERS.find((s) => s.slug === slug) : undefined;

  if (!speaker) {
    const archiveImage = `${baseURL}/past-speakers/og`;
    return {
      title: "Past Speakers",
      description:
        "Explore the history of speakers hosted by Stanford Speakers Bureau since 1935.",
      openGraph: {
        title: ARCHIVE_OG_TITLE,
        description: ARCHIVE_OG_DESCRIPTION,
        type: "website",
        siteName: "Stanford Speakers Bureau",
        url: "/past-speakers",
        images: [
          {
            url: archiveImage,
            width: 1200,
            height: 630,
            alt: "Stanford Speakers Bureau archive",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: ARCHIVE_OG_TITLE,
        description: ARCHIVE_OG_DESCRIPTION,
        images: [archiveImage],
      },
    };
  }

  const whenWhere = [
    [speaker.month, speaker.year].filter(Boolean).join(" "),
    speaker.location,
  ]
    .filter(Boolean)
    .join(" · ");
  const ogTitle = `${speaker.name} at Stanford Speakers Bureau`;
  const description = truncate(
    `${whenWhere ? `${whenWhere}. ` : ""}${speaker.bio}`,
    200,
  );
  const ogImage = `${baseURL}/past-speakers/og?speaker=${encodeURIComponent(
    speaker.slug,
  )}`;
  const alt = `${speaker.name} — Stanford Speakers Bureau`;

  return {
    title: speaker.name,
    description,
    alternates: {
      canonical: `/past-speakers?speaker=${encodeURIComponent(speaker.slug)}`,
    },
    openGraph: {
      title: ogTitle,
      description,
      type: "profile",
      siteName: "Stanford Speakers Bureau",
      url: `/past-speakers?speaker=${encodeURIComponent(speaker.slug)}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [ogImage],
    },
  };
}

export default function PastSpeakers() {
  return <PastSpeakersClient />;
}
