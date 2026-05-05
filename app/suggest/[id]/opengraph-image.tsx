import { ImageResponse } from "next/og";
import { db, eq, and, suggest } from "@ssb/db";
import { isValidUUID } from "@/app/lib/validation";

export const alt = "Should this person come speak at Stanford?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let speaker = "this person";
  if (isValidUUID(id)) {
    const row = await db.query.suggest.findFirst({
      where: and(
        eq(suggest.id, id),
        eq(suggest.approved, true),
        eq(suggest.spoke, false),
      ),
      columns: { speaker: true },
    });
    if (row?.speaker) speaker = row.speaker;
  }

  const logoUrl = `${baseURL}/wallet/logo_text2x.png`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "80px 96px",
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
            Cast Your Vote
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 84,
            fontWeight: 600,
            lineHeight: 1.04,
            letterSpacing: -2,
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 18,
            }}
          >
            <span>Should</span>
            <div
              style={{
                display: "flex",
                color: "white",
                fontWeight: 700,
                background: "#A80D0C",
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: 4,
                transform: "rotate(-1.4deg)",
                boxShadow:
                  "0 0 36px rgba(168,13,12,0.45), 0 6px 0 rgba(0,0,0,0.18)",
              }}
            >
              {speaker}
            </div>
          </div>
          <div style={{ display: "flex" }}>come speak at Stanford?</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 32,
            color: "#d4d4d8",
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span>Help us decide. Click to vote!</span>
          <span style={{ color: "#db4c3a" }}>→</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
