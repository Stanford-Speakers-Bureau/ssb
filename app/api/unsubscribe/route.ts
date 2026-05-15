import { NextResponse } from "next/server";
import { db, eq, events } from "@ssb/db";
import { verifyUnsubscribeToken } from "@/app/lib/unsubscribe-links";
import { recordSelfUnsubscribe } from "@/app/lib/mailing-list";

const ANNOUNCE_PHRASE = "speakers bureau";

function normalize(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function POST(req: Request) {
  let body: { token?: unknown; confirmation?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : null;
  const confirmation = typeof body.confirmation === "string"
    ? body.confirmation
    : "";

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const claims = await verifyUnsubscribeToken(token);
  if (!claims) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 },
    );
  }

  let eventName: string | null = null;
  if (claims.scope === "event") {
    const event = await db.query.events.findFirst({
      where: eq(events.id, claims.eventId),
      columns: { name: true },
    });
    eventName = event?.name ?? null;
  }

  const requiredPhrase = claims.scope === "announce"
    ? ANNOUNCE_PHRASE
    : eventName;

  if (!requiredPhrase || normalize(confirmation) !== normalize(requiredPhrase)) {
    return NextResponse.json(
      {
        error: `You must type "${requiredPhrase ?? ""}" to unsubscribe`,
      },
      { status: 400 },
    );
  }

  try {
    const { created } = await recordSelfUnsubscribe({
      email: claims.email,
      scope: claims.scope,
      eventId: claims.scope === "event" ? claims.eventId : null,
      source: "unsubscribe_link",
      eventName,
    });

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error("[unsubscribe] failed:", err);
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 },
    );
  }
}
