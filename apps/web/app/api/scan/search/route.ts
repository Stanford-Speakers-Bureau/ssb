import { NextResponse } from "next/server";
import { verifyAdminOrScannerRequest } from "@/app/lib/auth";
import {
  db,
  eq,
  and,
  or,
  ilike,
  asc,
  events,
  tickets,
  userProfiles,
} from "@ssb/db";

const MAX_RESULTS = 20;
const MIN_QUERY_LENGTH = 2;

// Escape characters that are special inside a SQL LIKE/ILIKE pattern so user
// input is treated literally (e.g. "a_b" shouldn't match any character).
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminOrScannerRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawQuery = (searchParams.get("q") ?? "").trim();

    if (rawQuery.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    // Only ever search the currently live event.
    const liveEvent = await db.query.events.findFirst({
      where: eq(events.live, true),
      columns: { id: true },
    });

    if (!liveEvent) {
      return NextResponse.json(
        { error: "No event is currently live.", results: [] },
        { status: 200 },
      );
    }

    const pattern = `%${escapeLike(rawQuery.toLowerCase())}%`;
    // SUNET → email convention: bare token matches the local part of a
    // Stanford address (e.g. "anishan" → anishan@stanford.edu).
    const sunet = rawQuery.toLowerCase();
    const sunetEmail = sunet.includes("@") ? sunet : `${sunet}@stanford.edu`;

    const rows = await db
      .select({
        id: tickets.id,
        type: tickets.type,
        scanned: tickets.scanned,
        scanTime: tickets.scanTime,
        email: tickets.email,
        ticketName: tickets.name,
        profileName: userProfiles.displayName,
        scanUser: tickets.scanUser,
        scanEmail: tickets.scanEmail,
      })
      .from(tickets)
      .leftJoin(userProfiles, eq(userProfiles.email, tickets.email))
      .where(
        and(
          eq(tickets.eventId, liveEvent.id),
          or(
            ilike(tickets.email, pattern),
            eq(tickets.email, sunetEmail),
            ilike(tickets.name, pattern),
            ilike(userProfiles.displayName, pattern),
            ilike(userProfiles.uid, pattern),
          ),
        ),
      )
      // Unscanned first (the common admit case), then alphabetical-ish by email.
      .orderBy(asc(tickets.scanned), asc(tickets.email))
      .limit(MAX_RESULTS);

    const results = rows.map((r) => ({
      id: r.id,
      type: r.type,
      scanned: r.scanned,
      scan_time: r.scanTime?.toISOString() ?? null,
      email: r.email,
      name: r.ticketName || r.profileName || null,
      scan_user: r.scanUser,
      scan_email: r.scanEmail,
    }));

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error("Ticket search error:", error);
    return NextResponse.json(
      { error: "Internal server error", results: [] },
      { status: 500 },
    );
  }
}
