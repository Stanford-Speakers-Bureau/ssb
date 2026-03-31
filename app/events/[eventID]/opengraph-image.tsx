import { ImageResponse } from "next/og";
import { getEventByRoute, isEventMystery, formatEventDate } from "@/app/lib/supabase";

export const alt = "Stanford Speakers Bureau event";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const fallbackImageUrl = `${baseURL}/speakers/jojo-siwa.jpg`;

export default async function Image({ params }: { params: Promise<{ eventID: string }> }) {
  const { eventID } = await params;
  const event = await getEventByRoute(eventID);

  if (!event || isEventMystery(event)) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            position: "relative",
            backgroundColor: "#0a0a0a",
          }}
        >
          <img
            src={fallbackImageUrl}
            alt=""
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              objectFit: "cover",
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
                "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.82) 100%)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              flexDirection: "column",
              gap: 24,
              position: "relative",
            }}
          >
            <img
              src={`${baseURL}/wallet/logo_text2x.png`}
              alt=""
              height={60}
            />
            <div
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.72)",
                textShadow: "0 2px 12px rgba(0,0,0,0.45)",
              }}
            >
              Stanford Speakers Bureau
            </div>
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const hasEventImage = !!(event.img || event.mobile_img);
  const imageUrl = hasEventImage
    ? `${baseURL}/api/images/${event.id}?v=${event.img_version || 1}`
    : fallbackImageUrl;
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
          background: "#0a0a0a",
        }}
      >
        {/* Background speaker image */}
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

        {/* SSB Logo - bottom right */}
        <img
          src={logoUrl}
          alt=""
          style={{
            position: "absolute",
            right: 40,
            bottom: 40,
            height: 56,
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
            right: 300,
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
