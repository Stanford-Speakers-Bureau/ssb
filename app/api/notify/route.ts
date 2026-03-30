import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { db, eq, and, events, notify } from "@ssb/db";
import { NOTIFY_MESSAGES } from "@/app/lib/constants";
import { notifyRatelimit, checkRateLimit } from "@/app/lib/ratelimit";
import { isValidUUID } from "@/app/lib/validation";

export async function POST(req: Request) {
  try {
    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { speaker_id } = body as { speaker_id?: string };

    // Validate input type
    if (!speaker_id || typeof speaker_id !== "string") {
      return NextResponse.json(
        { error: NOTIFY_MESSAGES.ERROR_MISSING_SPEAKER_ID },
        { status: 400 },
      );
    }

    // Validate UUID format
    if (!isValidUUID(speaker_id)) {
      return NextResponse.json(
        { error: "Invalid event ID format" },
        { status: 400 },
      );
    }

    // Verify event exists
    const event = await db.query.events.findFirst({
      where: eq(events.id, speaker_id),
      columns: { id: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: NOTIFY_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: NOTIFY_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    // Rate limit by user email
    const rateLimitResponse = await checkRateLimit(
      notifyRatelimit,
      `notify:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Check if notification signup already exists
    const existingNotify = await db.query.notify.findFirst({
      where: and(eq(notify.email, user.email), eq(notify.speakerId, speaker_id)),
      columns: { id: true },
    });

    if (existingNotify) {
      return NextResponse.json(
        { error: NOTIFY_MESSAGES.ALREADY_SIGNED_UP },
        { status: 409 },
      );
    }

    // Insert notification signup
    await db.insert(notify).values({ email: user.email, speakerId: speaker_id });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: NOTIFY_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}
