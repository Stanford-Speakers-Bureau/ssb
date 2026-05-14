import { NextResponse } from "next/server";
import { db, eq, events } from "@ssb/db";
import { verifyUnsubscribeToken } from "@/app/lib/unsubscribe-links";
import { recordSelfUnsubscribe } from "@/app/lib/mailing-list";

const REQUIRED_PHRASE = "i confirm";

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

  if (confirmation.trim().toLowerCase() !== REQUIRED_PHRASE) {
    return NextResponse.json(
      { error: 'You must type "i confirm" to unsubscribe' },
      { status: 400 },
    );
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
