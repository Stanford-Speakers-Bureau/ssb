import { ImageResponse } from "next/og";
import { SPOTLIGHT_SPEAKERS } from "@/app/config/speakers";
import { getHedvigSerif } from "@/app/lib/og-fonts";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const CORNER_SPEAKERS = SPOTLIGHT_SPEAKERS.filter(
  (s) => s.spotlightImage || s.image,
).slice(0, 4);

export const ogMosaicSize = { width: 1200, height: 630 } as const;
export const ogMosaicContentType = "image/png" as const;

export function heroOG({ heroImage }: { heroImage: string }) {
  return new ImageResponse(
    (
      <img
        src={`${baseURL}${heroImage}`}
        width={1200}
        height={630}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
        }}
      />
    ),
    { ...ogMosaicSize },
  );
}

export async function mosaicOG({ title }: { title?: string } = {}) {
  const logoUrl = `${baseURL}/ssb_white_logo_og.png`;
  const hedvig = await getHedvigSerif();
  const titleSize =
    !title
      ? 0
      : title.length > 28
        ? 52
        : title.length > 18
          ? 64
          : 76;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          background: "#0a0a0a",
          fontFamily: '"Hedvig Letters Serif", serif',
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
              "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.7) 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 1,
            padding: title ? "52px 72px" : "44px 64px",
            background: "rgba(10, 10, 10, 0.96)",
            border: "4px solid rgba(168, 13, 12, 0.85)",
            borderRadius: 16,
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.75)",
            maxWidth: 1000,
          }}
        >
          <img
            src={logoUrl}
            width={title ? 396 : 627}
            height={title ? 120 : 190}
            alt=""
          />
          {title && (
            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontSize: titleSize,
                color: "#fff8f1",
                letterSpacing: -1,
                textAlign: "center",
                lineHeight: 1.05,
              }}
            >
              {title}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...ogMosaicSize,
      fonts: [
        {
          name: "Hedvig Letters Serif",
          data: hedvig,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
