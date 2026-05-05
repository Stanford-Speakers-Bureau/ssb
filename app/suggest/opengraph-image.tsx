import { ImageResponse } from "next/og";
import { db, and, eq, suggest } from "@ssb/db";
import { getHedvigSerif } from "@/app/lib/og-fonts";

export const alt = "Stanford Speakers Bureau leaderboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

type Row = { id: string; speaker: string };

const MEDAL_EMOJIS = ["🥇", "🥈", "🥉"];
const MEDAL_COLORS = ["#FFD700", "#C0C8D1", "#CD7F32"];

async function getTopThree(): Promise<Row[]> {
  try {
    const rows = await db.query.suggest.findMany({
      where: and(eq(suggest.approved, true), eq(suggest.spoke, false)),
      columns: { id: true, speaker: true },
      orderBy: (s, { desc }) => [desc(s.votes)],
      limit: 3,
    });
    return rows
      .filter((r) => r.speaker)
      .map((r) => ({ id: r.id, speaker: r.speaker || "" }));
  } catch {
    return [];
  }
}

export default async function Image() {
  const rows = await getTopThree();
  const logoUrl = `${baseURL}/ssb_white_logo_og.png`;
  const hedvig = await getHedvigSerif();
  const hasRows = rows.length > 0;

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
          <img
            src={logoUrl}
            width={297}
            height={90}
            alt=""
          />
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
            The Leaderboard
          </div>
        </div>

        {hasRows ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {rows.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                  fontSize: 68,
                  lineHeight: 1.05,
                  letterSpacing: -1,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    fontSize: 80,
                    lineHeight: 1,
                  }}
                >
                  {MEDAL_EMOJIS[i]}
                </span>
                <div
                  style={{
                    color: MEDAL_COLORS[i],
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    maxWidth: 880,
                  }}
                >
                  {r.speaker}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                fontSize: 92,
                lineHeight: 1.04,
                letterSpacing: -2,
                color: "#fff8f1",
              }}
            >
              Who should speak at Stanford?
            </div>
            <div
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 32,
                color: "#f28c73",
              }}
            >
              Drop a name. Vote on others.
            </div>
          </div>
        )}

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
          <span>Help us decide! Who comes to Stanford next?</span>
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
