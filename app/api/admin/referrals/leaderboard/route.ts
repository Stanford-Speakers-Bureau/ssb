import { NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../../lib/supabase";

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    const adminClient = auth.adminClient!;

    let query = adminClient
      .from("referrals")
      .select(
        `
        referral_code,
        count,
        event_id,
        events (
          id,
          name,
          route,
          start_time_date
        )
      `,
      )
      .order("count", { ascending: false });

    if (eventId) {
      query = query.eq("event_id", eventId);
    }

    const { data: referrals, error } = await query;

    if (error) {
      console.error("Referrals fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch referral leaderboard" },
        { status: 500 },
      );
    }

    // Group by event if no eventId filter
    if (!eventId) {
      const groupedByEvent: Record<
        string,
        {
          event: { id: string; name: string | null; route: string | null };
          referrals: Array<{ referral_code: string; count: number }>;
        }
      > = {};

      referrals?.forEach((ref) => {
        const eventId = ref.event_id;
        if (!groupedByEvent[eventId]) {
          groupedByEvent[eventId] = {
            event: ref.events as { id: string; name: string | null; route: string | null },
            referrals: [],
          };
        }
        groupedByEvent[eventId].referrals.push({
          referral_code: ref.referral_code,
          count: ref.count || 0,
        });
      });

      // Sort referrals within each event by count
      Object.values(groupedByEvent).forEach((group) => {
        group.referrals.sort((a, b) => b.count - a.count);
      });

      return NextResponse.json({
        leaderboard: Object.values(groupedByEvent),
        grouped: true,
      });
    }

    // Single event - return flat list
    const leaderboard = (referrals || [])
      .map((ref) => ({
        referral_code: ref.referral_code,
        count: ref.count || 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      leaderboard,
      event: referrals?.[0]?.events,
      grouped: false,
    });
  } catch (error) {
    console.error("Referral leaderboard fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

