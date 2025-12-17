import { NextResponse } from "next/server";
import { verifyAdminOrScannerRequest } from "@/app/lib/supabase";

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminOrScannerRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const adminClient = auth.adminClient!;

    // Get the live event
    const { data: liveEvent, error: liveEventError } = await adminClient
      .from("events")
      .select("id, name, venue, start_time_date, scanned, tickets, reserved")
      .eq("live", true)
      .single();

    if (liveEventError || !liveEvent) {
      return NextResponse.json({ liveEvent: null }, { status: 200 });
    }

    // Calculate total tickets sold (use tickets field, fallback to reserved)
    const totalSold = liveEvent.tickets ?? liveEvent.reserved ?? 0;

    return NextResponse.json(
      {
        liveEvent: {
          id: liveEvent.id,
          name: liveEvent.name,
          venue: liveEvent.venue,
          start_time_date: liveEvent.start_time_date,
          scanned: liveEvent.scanned || 0,
          totalSold: totalSold,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Live event fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
