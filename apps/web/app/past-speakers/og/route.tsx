import { ImageResponse } from "next/og";
import { SPEAKERS, SPOTLIGHT_SPEAKERS } from "@/app/config/speakers";
import type { Speaker } from "@/app/config/speakers";
import { getHedvigSerif } from "@/app/lib/og-fonts";
import { truncate } from "@/app/lib/metadata";

export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };
const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Cache aggressively: speaker data only changes on deploy, and social crawlers
// re-fetch these images frequently.
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

// Renders the Open Graph card for /past-speakers. With ?speaker=<slug> it draws
// that speaker's profile card; otherwise it draws the archive card. This lives
// in a route handler (not an opengraph-image file) because the file convention
// can't read query params — and ?speaker drives the page's deeplink.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("speaker");
  const speaker = slug ? SPEAKERS.find((s) => s.slug === slug) : undefined;
  const hedvig = await getHedvigSerif();

  const fonts = [
    {
      name: "Hedvig Letters Serif",
      data: hedvig,
      style: "normal" as const,
      weight: 400 as const,
    },
  ];

  return new ImageResponse(
    speaker ? <SpeakerCard speaker={speaker} /> : <ArchiveCard />,
    { ...SIZE, fonts, headers: CACHE_HEADERS },
  );
}

function SpeakerCard({ speaker }: { speaker: Speaker }) {
  const logoUrl = `${baseURL}/ssb_white_logo_og.png`;
  const imgPath = speaker.spotlightImage || speaker.image;
  const monthYear = [speaker.month, speaker.year].filter(Boolean).join(" ");
  const bio = truncate(speaker.bio, 220);
  // Keep long names from overflowing the right column on one line.
  const nameSize = speaker.name.length > 20 ? 60 : 74;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a0606 100%)",
        fontFamily: '"Hedvig Letters Serif", serif',
        color: "#fff8f1",
      }}
    >
      {imgPath ? (
        <div style={{ display: "flex", position: "relative", width: 470, height: "100%" }}>
          <img
            src={`${baseURL}${imgPath}`}
            width={470}
            height={630}
            style={{
              objectFit: "cover",
              objectPosition: "center top",
              width: "100%",
              height: "100%",
            }}
            alt=""
          />
          {/* Fade the photo's right edge into the dark content column. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 130,
              background:
                "linear-gradient(90deg, rgba(20,6,6,0) 0%, rgba(20,6,6,0.92) 100%)",
            }}
          />
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: imgPath ? "52px 64px 46px 52px" : "60px 80px",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <img src={logoUrl} width={231} height={70} alt="" />
          <div
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#db4c3a",
            }}
          >
            Past Speaker
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {monthYear || speaker.location ? (
            <div
              style={{
                display: "flex",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
                gap: 12,
              }}
            >
              {monthYear ? <span style={{ color: "#f28c73" }}>{monthYear}</span> : null}
              {monthYear && speaker.location ? (
                <span style={{ color: "rgba(255,248,241,0.4)" }}>·</span>
              ) : null}
              {speaker.location ? (
                <span style={{ color: "rgba(255,248,241,0.72)" }}>{speaker.location}</span>
              ) : null}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              fontSize: nameSize,
              lineHeight: 1.0,
              letterSpacing: -1.5,
            }}
          >
            {speaker.name}
          </div>

          {speaker.title ? (
            <div
              style={{
                display: "flex",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 23,
                fontWeight: 500,
                color: "rgba(255,248,241,0.82)",
                lineHeight: 1.25,
              }}
            >
              {speaker.title}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 19,
              fontWeight: 400,
              color: "rgba(255,248,241,0.55)",
              lineHeight: 1.45,
              marginTop: 4,
            }}
          >
            {bio}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 28,
            paddingTop: 22,
            borderTop: "3px solid rgba(168, 13, 12, 0.55)",
          }}
        >
          <span>Spoke at Stanford</span>
          <span style={{ color: "#db4c3a" }}>→</span>
        </div>
      </div>
    </div>
  );
}

function ArchiveCard() {
  const top = SPOTLIGHT_SPEAKERS.slice(0, 3);
  const logoUrl = `${baseURL}/ssb_white_logo_og.png`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "64px 80px",
        background: "linear-gradient(180deg, #0a0a0a 0%, #1a0606 100%)",
        fontFamily: '"Hedvig Letters Serif", serif',
        color: "#fff8f1",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <img src={logoUrl} width={297} height={90} alt="" />
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#db4c3a",
          }}
        >
          The Archive
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
        {top.map((s) => {
          const imgPath = s.spotlightImage || s.image;
          return (
            <div
              key={s.slug}
              style={{
                position: "relative",
                display: "flex",
                width: 332,
                height: 360,
                borderRadius: 10,
                overflow: "hidden",
                background: "#1a0606",
                boxShadow:
                  "0 12px 28px rgba(0,0,0,0.45), 0 2px 0 rgba(168,13,12,0.3) inset",
              }}
            >
              {imgPath ? (
                <img
                  src={`${baseURL}${imgPath}`}
                  width={332}
                  height={360}
                  style={{
                    objectFit: "cover",
                    objectPosition: "center top",
                    width: "100%",
                    height: "100%",
                  }}
                  alt=""
                />
              ) : null}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  padding: "70px 22px 18px",
                  background:
                    "linear-gradient(180deg, rgba(10,5,5,0) 0%, rgba(10,5,5,0.85) 50%, rgba(10,5,5,0.96) 100%)",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 3,
                    color: "#f28c73",
                    textTransform: "uppercase",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    maxWidth: 288,
                  }}
                >
                  {[s.month, s.year].filter(Boolean).join(" ")}
                </span>
                <span
                  style={{
                    fontFamily: '"Hedvig Letters Serif", serif',
                    fontSize: 30,
                    color: "#fff8f1",
                    lineHeight: 1.05,
                    letterSpacing: -0.5,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    maxWidth: 288,
                  }}
                >
                  {s.name}
                </span>
                {s.location ? (
                  <span
                    style={{
                      fontFamily: "Inter, system-ui, sans-serif",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "rgba(255,248,241,0.62)",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      maxWidth: 288,
                      marginTop: 2,
                    }}
                  >
                    {s.location}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: '"Hedvig Letters Serif", serif',
          fontSize: 36,
          color: "#fff8f1",
          paddingTop: 20,
          borderTop: "3px solid rgba(168, 13, 12, 0.55)",
        }}
      >
        <span>Browse the archive</span>
        <span style={{ color: "#db4c3a" }}>→</span>
      </div>
    </div>
  );
}
