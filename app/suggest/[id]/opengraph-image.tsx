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
      where: and(eq(suggest.id, id), eq(suggest.approved, true)),
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
        <div style={{ display: "flex", alignItems: "center" }}>
          <img
            src={logoUrl}
            width={260}
            height={56}
            style={{ objectFit: "contain" }}
            alt=""
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "#db4c3a",
            }}
          >
            Stanford Speakers Bureau
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              lineHeight: 1.04,
              letterSpacing: -2,
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
            }}
          >
            <span>Should</span>
            <span style={{ color: "#f28c73" }}>{speaker}</span>
            <span>come speak at Stanford?</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 28,
            color: "#a1a1aa",
          }}
        >
          <span>Tap to vote →</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
