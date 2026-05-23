import { NextResponse } from "next/server";
import { getTicketCounts } from "@/app/lib/supabase";
import { verifyAdminOrScannerRequest } from "@/app/lib/auth";
import { db, eq, events } from "@ssb/db";

/**
 * Public endpoint to check if there's a live event
 * Used by frontend components to determine if ticket cancellation should be disabled
 */
export async function GET() {
  try {
    const liveEvent = await db.query.events.findFirst({
      where: eq(events.live, true),
      columns: { id: true, name: true, venue: true, startTimeDate: true, scanned: true, tickets: true, reserved: true, identityVerificationEnabled: true, allowAdmittingStandby: true },
    });

    if (!liveEvent) {
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
      const ticketCounts = await getTicketCounts(liveEvent.id);
      const totalSold = ticketCounts.totalCount;

      return NextResponse.json(
        {
          liveEvent: {
            id: liveEvent.id,
            name: liveEvent.name,
            venue: liveEvent.venue,
            start_time_date: liveEvent.startTimeDate?.toISOString() ?? null,
            scanned: liveEvent.scanned || 0,
            totalSold: totalSold,
            identity_verification_enabled: liveEvent.identityVerificationEnabled,
            allow_admitting_standby: liveEvent.allowAdmittingStandby,
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
