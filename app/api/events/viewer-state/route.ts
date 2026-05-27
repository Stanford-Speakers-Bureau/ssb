import { NextResponse } from "next/server";
import { isValidUUID } from "@/app/lib/validation";
import { getViewerEventState } from "@/app/lib/viewer-event-state";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || searchParams.get("event_id");

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "Missing required query parameter: eventId" },
        { status: 400 },
      );
    }

    if (!isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Invalid event ID format" },
        { status: 400 },
      );
    }

    return NextResponse.json(await getViewerEventState(eventId), {
      status: 200,
    });
  } catch (error) {
    console.error("Viewer event state fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch viewer event state" },
      { status: 500 },
    );
  }
}
