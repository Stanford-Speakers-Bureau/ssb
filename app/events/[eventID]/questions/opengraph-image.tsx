import { ImageResponse } from "next/og";
import {
  and,
  db,
  eq,
  eventQuestions,
  events,
} from "@ssb/db";
import { getHedvigSerif } from "@/app/lib/og-fonts";
import { isValidUUID } from "@/app/lib/validation";

export const alt = "Moderator Q&A at Stanford Speakers Bureau";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

async function resolveEvent(routeOrId: string) {
  return db.query.events.findFirst({
    where: isValidUUID(routeOrId)
      ? eq(events.id, routeOrId)
      : eq(events.route, routeOrId),
    columns: { id: true, name: true },
  });
}

async function getTopThree(eventId: string) {
  try {
    const rows = await db.query.eventQuestions.findMany({
      where: and(
        eq(eventQuestions.eventId, eventId),
        eq(eventQuestions.approved, true),
        eq(eventQuestions.hidden, false),
      ),
      columns: { id: true, question: true },
      orderBy: (q, { desc, asc }) => [desc(q.votes), asc(q.createdAt)],
      limit: 3,
    });
    return rows.map((r) => ({ id: r.id, question: r.question }));
  } catch {
    return [];
  }
}

function truncate(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export default async function Image({
  params,
}: {
  params: { eventID: string };
}) {
  const event = await resolveEvent(params.eventID);
  const eventName = event?.name ?? "Stanford Speakers Bureau";
  const rows = event ? await getTopThree(event.id) : [];
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
          padding: "72px 88px",
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
          <img src={logoUrl} width={264} height={80} alt="" />
          <div
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#db4c3a",
            }}
          >
            Moderator Q&amp;A
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 56,
              lineHeight: 1.05,
              letterSpacing: -1,
              color: "#fff8f1",
              maxWidth: 1024,
            }}
          >
            What should the moderator ask{" "}
            <span style={{ color: "#db4c3a" }}>{truncate(eventName, 50)}</span>?
          </div>
          {hasRows ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 18,
                    fontSize: 28,
                    lineHeight: 1.2,
                    color: "#e5e0d7",
                  }}
                >
                  <span style={{ color: "#db4c3a", fontWeight: 700 }}>
                    {i + 1}.
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 1000,
                    }}
                  >
                    {truncate(r.question, 90)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 26,
                color: "#f28c73",
              }}
            >
              Be the first to submit a question.
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 32,
            color: "#fff8f1",
            paddingTop: 20,
            borderTop: "3px solid rgba(168, 13, 12, 0.55)",
          }}
        >
          <span>Ask &amp; vote on questions →</span>
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
