import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { db, notify } from "@ssb/db";
import { NOTIFY_MESSAGES } from "@/app/lib/constants";
import { isValidUUID } from "@/app/lib/validation";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: NOTIFY_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

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

    const insertedRows = await db.insert(notify)
      .values({ email: user.email, speakerId: speaker_id })
      .onConflictDoNothing()
      .returning({ id: notify.id });

    return NextResponse.json(
      {
        success: true,
        alreadySignedUp: insertedRows.length === 0,
      },
      { status: 200 },
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23503") {
      return NextResponse.json(
        { error: NOTIFY_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 },
      );
    }

    console.error("Error signing up for notifications:", error);
    return NextResponse.json(
      { error: NOTIFY_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}
