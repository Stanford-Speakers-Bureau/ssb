import { NextResponse } from "next/server";
import {
  getSupabaseClient,
  verifyAdminOrScannerRequest,
  getTicketCounts,
} from "@/app/lib/supabase";

/**
 * Public endpoint to check if there's a live event
 * Used by frontend components to determine if ticket cancellation should be disabled
 */
export async function GET() {
  try {
    const adminClient = getSupabaseClient();

    // Get the live event
    const { data: liveEvent, error: liveEventError } = await adminClient
      .from("events")
      .select("id, name, venue, start_time_date, scanned, tickets, reserved")
      .eq("live", true)
      .single();

    if (liveEventError || !liveEvent) {
      return NextResponse.json(
        { isLive: false, liveEvent: null },
        { status: 200 },
      );
    }


    const auth = await verifyAdminOrScannerRequest();
    if (!auth.authorized) {
      return NextResponse.json(
        {
          isLive: true,
          liveEvent: {
            id: liveEvent.id,
          },
        },
        { status: 200 },
      );
    } else {
      // Calculate total tickets sold by counting directly from tickets table
      // This is more accurate than using the cached events.tickets field
      const ticketCounts = await getTicketCounts(liveEvent.id);
      const totalSold = ticketCounts.totalCount;

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
    }
  } catch (error) {
    console.error("Live event fetch error:", error);
    return NextResponse.json(
      { isLive: false, liveEvent: null },
      { status: 200 },
    );
  }
}
