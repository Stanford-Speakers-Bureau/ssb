import { NextResponse } from "next/server";
import { db, eq, events } from "@ssb/db";
import { verifyUnsubscribeToken } from "@/app/lib/unsubscribe-links";
import { recordSelfUnsubscribe } from "@/app/lib/mailing-list";

const ANNOUNCE_PHRASE = "speakers bureau";
const NEWSLETTER_PHRASE = "newsletter";

function normalize(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function POST(req: Request) {
  let body: { token?: unknown; confirmation?: unknown; alsoAnnounce?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : null;
  const confirmation =
    typeof body.confirmation === "string" ? body.confirmation : "";
  const alsoAnnounce = body.alsoAnnounce === true;

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

  // Opt-out from all future speaker events (announcements list), offered from an
  // event-scope unsubscribe link. Requires the same typed phrase as the primary
  // announce unsubscribe flow.
  if (alsoAnnounce) {
    if (claims.scope !== "event") {
      return NextResponse.json(
        { error: "alsoAnnounce is only valid for event unsubscribe links" },
        { status: 400 },
      );
    }
    if (normalize(confirmation) !== normalize(ANNOUNCE_PHRASE)) {
      return NextResponse.json(
        { error: `You must type "${ANNOUNCE_PHRASE}" to unsubscribe` },
        { status: 400 },
      );
    }
    try {
      const { created } = await recordSelfUnsubscribe({
        email: claims.email,
        scope: "announce",
        source: "unsubscribe_link",
      });
      return NextResponse.json({ ok: true, created, scope: "announce" });
    } catch (err) {
      console.error("[unsubscribe] announce opt-out failed:", err);
      return NextResponse.json(
        { error: "Failed to unsubscribe" },
        { status: 500 },
      );
    }
  }

  let eventName: string | null = null;
  if (claims.scope === "event") {
    const event = await db.query.events.findFirst({
      where: eq(events.id, claims.eventId),
      columns: { name: true },
    });
    eventName = event?.name ?? null;
  }

  const requiredPhrase =
    claims.scope === "announce"
      ? ANNOUNCE_PHRASE
      : claims.scope === "newsletter"
        ? NEWSLETTER_PHRASE
        : eventName;

  if (
    !requiredPhrase ||
    normalize(confirmation) !== normalize(requiredPhrase)
  ) {
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
