import { ImageResponse } from "next/og";
import { SPOTLIGHT_SPEAKERS } from "@/app/config/speakers";

export const alt = "Stanford Speakers Bureau archive";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export default async function Image() {
  const top = SPOTLIGHT_SPEAKERS.slice(0, 3);
  const logoUrl = `${baseURL}/wallet/logo_text2x.png`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "64px 80px",
          background: "linear-gradient(180deg, #0a0a0a 0%, #1a0606 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "white",
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
          <img src={logoUrl} width={275} height={86} alt="" />
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "#db4c3a",
            }}
          >
            The Archive
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
          }}
        >
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
                      fontSize: 13,
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
                      fontSize: 26,
                      fontWeight: 700,
                      color: "white",
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
                        fontSize: 13,
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.62)",
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
            fontSize: 32,
            color: "#d4d4d8",
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span>Browse the archive</span>
          <span style={{ color: "#db4c3a" }}>→</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
