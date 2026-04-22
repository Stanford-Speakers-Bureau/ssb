import { ImageResponse } from "next/og";
import {
  getClosestUpcomingEvent,
  getSignedImageUrl,
  isEventMystery,
} from "@/app/lib/supabase";

export const alt = "Stanford Speakers Bureau";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export default async function Image() {
  const rawEvent = await getClosestUpcomingEvent();
  // Treat mystery events as "no event" so we don't leak the speaker art/name/venue/date.
  const event = rawEvent && !isEventMystery(rawEvent) ? rawEvent : null;
  const hasEventImage = !!(event?.img || event?.mobile_img);
  const signedImageUrl = hasEventImage
    ? await getSignedImageUrl(event?.img || event?.mobile_img || null)
    : null;

  const imageUrl = signedImageUrl || (event?.id && hasEventImage
    ? `${baseURL}/api/images/${event.id}?v=${event.img_version || 1}`
    : `${baseURL}/speakers/jojo-siwa.jpg`);
  const logoUrl = `${baseURL}/wallet/logo_text2x.png`;
  const showUpcomingSpeakerLabel = Boolean(event?.name);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Background speaker image */}
        <img
          src={imageUrl}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Bottom-weighted darkening gradient for text legibility */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.65) 75%, rgba(0,0,0,0.92) 100%)",
          }}
        />

        {/* Text content - bottom center */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            position: "absolute",
            bottom: 56,
            left: 80,
            right: 80,
          }}
        >
          {event?.name ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
                maxWidth: 980,
              }}
            >
              {showUpcomingSpeakerLabel && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    width: "100%",
                    marginBottom: 14,
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: 4,
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.82)",
                    textShadow: "0 1px 10px rgba(0,0,0,0.6)",
                  }}
                >
                  Upcoming Speaker
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  width: "100%",
                  fontSize: 76,
                  fontWeight: 800,
                  color: "white",
                  lineHeight: 1.05,
                  letterSpacing: -1.5,
                  textShadow: "0 2px 18px rgba(0,0,0,0.7)",
                  textAlign: "center",
                }}
              >
                {event.name}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  width: "100%",
                  marginTop: 18,
                }}
              >
                <img src={logoUrl} alt="" style={{ height: 96 }} />
              </div>
            </div>
          ) : (
            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: "rgba(255,255,255,0.95)",
                lineHeight: 1.15,
                letterSpacing: -0.5,
                textShadow: "0 2px 14px rgba(0,0,0,0.6)",
                textAlign: "center",
                maxWidth: 900,
              }}
            >
              Stanford&apos;s largest student organization sponsor of speaking events since 1935
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
