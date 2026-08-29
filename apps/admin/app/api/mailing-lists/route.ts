import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { isValidEmail, isValidUUID, normalizeEmail } from "@/app/lib/validation";
import { db, eq, events } from "@ssb/db";
import {
  announceStats,
  isUnsubscribeScope,
  listAnnounceMembers,
  listAnnounceOptOuts,
  listEventOptOuts,
  listNewsletterMembers,
  listNewsletterOptOuts,
  newsletterStats,
  recordResubscribe,
  recordUnsubscribe,
} from "@/app/lib/mailing-list";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(req: Request) {
  try {
    // Mailing-list views span all events, so they need the all-events scope.
    const auth = await requirePermission("audience.view");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "announce";

    if (view === "stats") {
      const stats = await announceStats();
      return NextResponse.json(stats);
    }

    if (view === "announce") {
      const search = url.searchParams.get("search");
      const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
      const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
      const [{ rows, total }, optOuts, stats] = await Promise.all([
        listAnnounceMembers({ search, limit, offset }),
        listAnnounceOptOuts(),
        announceStats(),
      ]);
      return NextResponse.json({
        rows,
        total,
        optOuts,
        stats,
        limit,
        offset,
      });
    }

    if (view === "newsletter") {
      const search = url.searchParams.get("search");
      const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
      const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
      const [{ rows, total }, optOuts, stats] = await Promise.all([
        listNewsletterMembers({ search, limit, offset }),
        listNewsletterOptOuts(),
        newsletterStats(),
      ]);
      return NextResponse.json({
        rows,
        total,
        optOuts,
        stats,
        limit,
        offset,
      });
    }

    if (view === "event") {
      const eventId = url.searchParams.get("eventId");
      if (!eventId || !isValidUUID(eventId)) {
        return NextResponse.json(
          { error: "eventId is required and must be a valid UUID" },
          { status: 400 },
        );
      }
      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: { id: true, name: true },
      });
      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      const optOuts = await listEventOptOuts(eventId);
      return NextResponse.json({ event, optOuts });
    }

    return NextResponse.json({ error: "Unknown view" }, { status: 400 });
  } catch (err) {
    console.error("Mailing list GET error:", err);
    return NextResponse.json(
      { error: "Failed to load mailing list" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    let body: {
      action?: unknown;
      scope?: unknown;
      email?: unknown;
      eventId?: unknown;
      reason?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const action = body.action === "unsubscribe" || body.action === "resubscribe"
      ? body.action
      : null;
    if (!action) {
      return NextResponse.json(
        { error: "action must be 'unsubscribe' or 'resubscribe'" },
        { status: 400 },
      );
    }

    const scope = isUnsubscribeScope(body.scope) ? body.scope : null;
    if (!scope) {
      return NextResponse.json(
        { error: "scope must be 'announce', 'event', or 'newsletter'" },
        { status: 400 },
      );
    }

    const rawEmail = typeof body.email === "string" ? body.email : "";
    const email = normalizeEmail(rawEmail);
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "valid email required" },
        { status: 400 },
      );
    }

    const eventId = scope === "event"
      ? typeof body.eventId === "string" ? body.eventId : null
      : null;
    if (scope === "event" && (!eventId || !isValidUUID(eventId))) {
      return NextResponse.json(
        { error: "valid eventId required for event scope" },
        { status: 400 },
      );
    }

    const auth = await requirePermission(
      "audience.view",
      scope === "event" ? eventId : null,
    );
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const reason = typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 500)
      : null;

    let eventName: string | null = null;
    if (scope === "event") {
      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId!),
        columns: { name: true },
      });
      eventName = event?.name ?? null;
    }

    if (action === "unsubscribe") {
      const { created } = await recordUnsubscribe({
        email,
        scope,
        eventId,
        source: "admin_manual",
        actor: auth.email!,
        reason,
        audit: { action: "mailing_list.admin_unsubscribe", eventName },
      });
      return NextResponse.json({ ok: true, created });
    }

    const { removed } = await recordResubscribe({
      email,
      scope,
      eventId,
      actor: auth.email!,
      audit: { action: "mailing_list.admin_resubscribe", eventName },
    });
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    console.error("Mailing list POST error:", err);
    return NextResponse.json(
      { error: "Failed to update mailing list" },
      { status: 500 },
    );
  }
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
