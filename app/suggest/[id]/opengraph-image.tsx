import { ImageResponse } from "next/og";
import { db, eq, and, suggest } from "@ssb/db";
import { isValidUUID } from "@/app/lib/validation";
import { getHedvigSerif } from "@/app/lib/og-fonts";

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

  const logoUrl = `${baseURL}/ssb_white_logo_og.png`;
  const hedvig = await getHedvigSerif();

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
            Cast Your Vote
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 88,
            lineHeight: 1.04,
            letterSpacing: -2,
            gap: 6,
            color: "#fff8f1",
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
                color: "#fff8f1",
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
            fontSize: 36,
            color: "#fff8f1",
            paddingTop: 24,
            borderTop: "3px solid rgba(168, 13, 12, 0.55)",
          }}
        >
          <span>Help us decide. Click to vote!</span>
          <span style={{ color: "#db4c3a" }}>→</span>
        </div>
      </div>
    ),
    {
      ...size,
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
