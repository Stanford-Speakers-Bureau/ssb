import { ImageResponse } from "next/og";
import { db, and, eq, suggest } from "@ssb/db";

export const alt = "Stanford Speakers Bureau leaderboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

type Row = { id: string; speaker: string };

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

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
  const logoUrl = `${baseURL}/wallet/logo_text2x.png`;
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
          <img
            src={logoUrl}
            width={275}
            height={86}
            alt=""
          />
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
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
                  fontSize: 56,
                  fontWeight: 600,
                  lineHeight: 1.05,
                  letterSpacing: -1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    width: 160,
                    color: "#f28c73",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  <span style={{ lineHeight: 1 }}>{i + 1}</span>
                  <span
                    style={{ fontSize: 32, marginLeft: 4, lineHeight: 1 }}
                  >
                    {ordinalSuffix(i + 1)}
                  </span>
                </div>
                <div
                  style={{
                    color: "white",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    maxWidth: 820,
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
                fontSize: 88,
                fontWeight: 600,
                lineHeight: 1.04,
                letterSpacing: -2,
              }}
            >
              Who should speak at Stanford?
            </div>
            <div style={{ fontSize: 32, color: "#f28c73" }}>
              Drop a name. Vote on others.
            </div>
          </div>
        )}

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
          <span>Who comes to Stanford next?</span>
          <span style={{ color: "#db4c3a" }}>→</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
