import { ImageResponse } from "next/og";
import { getEventByRoute, isEventMystery, formatEventDate } from "@/app/lib/supabase";

export const alt = "Stanford Speakers Bureau event";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export default async function Image({ params }: { params: Promise<{ eventID: string }> }) {
  const { eventID } = await params;
  const event = await getEventByRoute(eventID);

  if (!event || isEventMystery(event)) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            backgroundColor: "#0a0a0a",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${baseURL}/wallet/logo_text2x.png`}
            alt=""
            height={60}
          />
          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.5)" }}>
            Stanford Speakers Bureau
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const imageUrl = `${baseURL}/api/images/${event.id}?v=${event.img_version || 1}`;
  const logoUrl = `${baseURL}/wallet/logo_text2x.png`;
  const dateStr = formatEventDate(event.start_time_date);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        {/* Background speaker image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Dark gradient overlay */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.85) 100%)",
          }}
        />

        {/* SSB Logo - top left */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          style={{
            position: "absolute",
            top: 32,
            left: 40,
            height: 36,
          }}
        />

        {/* Text content - bottom left */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "absolute",
            bottom: 40,
            left: 40,
            right: 40,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "white",
              lineHeight: 1.15,
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
            }}
          >
            {event.name}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: 24,
              color: "rgba(255,255,255,0.9)",
              gap: 12,
              textShadow: "0 1px 6px rgba(0,0,0,0.5)",
            }}
          >
            {dateStr && <span>{dateStr}</span>}
            {dateStr && event.venue && (
              <span style={{ color: "rgba(255,255,255,0.5)" }}>/</span>
            )}
            {event.venue && <span>{event.venue}</span>}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
