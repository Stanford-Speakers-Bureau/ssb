import { ImageResponse } from "next/og";
import {
  getClosestUpcomingEvent,
  getSignedImageUrl,
  isEventMystery,
} from "@/app/lib/supabase";
import { SPOTLIGHT_SPEAKERS } from "@/app/config/speakers";
import { getHedvigSerif } from "@/app/lib/og-fonts";

export const alt = "Stanford Speakers Bureau";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const hasSupabaseStorageCredentials = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_KEY,
);

const CORNER_SPEAKERS = SPOTLIGHT_SPEAKERS.filter(
  (s) => s.spotlightImage || s.image,
).slice(0, 4);

function Card({
  logoUrl,
  eyebrow,
  headline,
  headlineSize,
  compact = false,
}: {
  logoUrl: string;
  eyebrow: string;
  headline: string;
  headlineSize: number;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: compact ? "28px 40px" : "48px 64px",
        background: "rgba(10, 10, 10, 0.96)",
        border: "4px solid rgba(168, 13, 12, 0.85)",
        borderRadius: compact ? 12 : 16,
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.75)",
        color: "#fff8f1",
        zIndex: 1,
        maxWidth: compact ? 800 : 980,
      }}
    >
      <img
        src={logoUrl}
        width={compact ? 297 : 462}
        height={compact ? 90 : 140}
        alt=""
      />
      <div
        style={{
          display: "flex",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: compact ? 16 : 22,
          fontWeight: 700,
          letterSpacing: compact ? 4 : 6,
          textTransform: "uppercase",
          color: "#db4c3a",
          marginTop: compact ? 18 : 28,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: '"Hedvig Letters Serif", serif',
          fontSize: headlineSize,
          lineHeight: 1.05,
          letterSpacing: -1,
          marginTop: compact ? 6 : 12,
          textAlign: "center",
          color: "#fff8f1",
        }}
      >
        {headline}
      </div>
    </div>
  );
}

export default async function Image() {
  const rawEvent = await getClosestUpcomingEvent();
  const event = rawEvent && !isEventMystery(rawEvent) ? rawEvent : null;
  const logoUrl = `${baseURL}/ssb_white_logo_og.png`;
  const hedvig = await getHedvigSerif();
  const fonts = [
    {
      name: "Hedvig Letters Serif",
      data: hedvig,
      style: "normal" as const,
      weight: 400 as const,
    },
  ];

  let signedImageUrl: string | null = null;
  if (
    event &&
    (event.img || event.mobile_img) &&
    hasSupabaseStorageCredentials
  ) {
    try {
      signedImageUrl = await getSignedImageUrl(event.img || event.mobile_img);
    } catch {
      signedImageUrl = null;
    }
  }

  const eyebrow = "Upcoming Speaker";
  const headline = event?.name ?? "";
  const headlineSize = event?.name
    ? event.name.length > 24
      ? 48
      : event.name.length > 16
        ? 60
        : 72
    : 72;

  // Mode 1: Real photo of THIS upcoming speaker → full-bleed photo with a
  // compact card pinned near the bottom so the speaker's face stays visible.
  if (signedImageUrl && event?.name) {
    const photoHeadlineSize =
      event.name.length > 24 ? 36 : event.name.length > 16 ? 44 : 52;

    return new ImageResponse(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          background: "#0a0a0a",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <img
          src={signedImageUrl}
          width={1200}
          height={630}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.4) 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 28,
            paddingLeft: 28,
            paddingRight: 28,
          }}
        >
          <Card
            logoUrl={logoUrl}
            eyebrow={eyebrow}
            headline={headline}
            headlineSize={photoHeadlineSize}
            compact
          />
        </div>
      </div>,
      { ...size, fonts },
    );
  }

  // Mode 2: Upcoming event without a usable photo → 2x2 mosaic + centered card.
  if (event?.name) {
    return new ImageResponse(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          background: "#0a0a0a",
          fontFamily: "system-ui, -apple-system, sans-serif",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          {CORNER_SPEAKERS.map((s) => {
            const img = s.spotlightImage || s.image;
            return (
              <div
                key={s.slug}
                style={{
                  display: "flex",
                  width: 600,
                  height: 315,
                  overflow: "hidden",
                }}
              >
                <img
                  src={`${baseURL}${img}`}
                  width={600}
                  height={315}
                  style={{
                    objectFit: "cover",
                    objectPosition: "center top",
                    width: "100%",
                    height: "100%",
                  }}
                  alt=""
                />
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        <Card
          logoUrl={logoUrl}
          eyebrow={eyebrow}
          headline={headline}
          headlineSize={headlineSize}
        />
      </div>,
      { ...size, fonts },
    );
  }

  // Mode 3: Nothing upcoming → just the logo, centered on a brand background.
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #0a0a0a 0%, #1a0606 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <img src={logoUrl} width={791} height={240} alt="" />
    </div>,
    { ...size },
  );
}
