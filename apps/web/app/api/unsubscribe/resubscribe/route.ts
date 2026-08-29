import { NextResponse } from "next/server";
import { db, eq, events } from "@ssb/db";
import { verifyUnsubscribeToken } from "@/app/lib/unsubscribe-links";
import { recordSelfResubscribe } from "@/app/lib/mailing-list";

export async function POST(req: Request) {
  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : null;
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

  try {
    const { removed } = await recordSelfResubscribe({
      email: claims.email,
      scope: claims.scope,
      eventId: claims.scope === "event" ? claims.eventId : null,
      eventName,
    });

    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    console.error("[resubscribe] failed:", err);
    return NextResponse.json(
      { error: "Failed to resubscribe" },
      { status: 500 },
    );
  }
}
