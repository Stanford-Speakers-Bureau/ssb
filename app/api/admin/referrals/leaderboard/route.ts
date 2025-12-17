import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/app/lib/supabase";

type EventData = {
  id: string;
  name: string | null;
  route: string | null;
  start_time_date: string | null;
};

type ReferralRow = {
  referral_code: string;
  count: number | null;
  event_id: string;
  events: EventData | EventData[] | null;
};

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

    const typedReferrals = (referrals || []) as ReferralRow[];

    // Group by event if no eventId filter
    if (!eventId) {
      const groupedByEvent: Record<
        string,
        {
          event: { id: string; name: string | null; route: string | null };
          referrals: Array<{ referral_code: string; count: number }>;
        }
      > = {};

      typedReferrals.forEach((ref) => {
        const eventId = ref.event_id;
        if (!eventId) return;

        // Handle events relation - Supabase may return it as array or object
        let eventData: EventData | null = null;

        if (Array.isArray(ref.events)) {
          eventData = ref.events[0] || null;
        } else if (ref.events) {
          eventData = ref.events;
        }

        if (!eventData || !eventData.id) return;

        if (!groupedByEvent[eventId]) {
          groupedByEvent[eventId] = {
            event: {
              id: eventData.id,
              name: eventData.name ?? null,
              route: eventData.route ?? null,
            },
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
    const leaderboard = typedReferrals
      .map((ref) => ({
        referral_code: ref.referral_code,
        count: ref.count || 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Handle events relation - Supabase may return it as array or object
    let eventData: EventData | null = null;

    const firstRef = typedReferrals[0];
    if (firstRef?.events) {
      if (Array.isArray(firstRef.events)) {
        eventData = firstRef.events[0] || null;
      } else {
        eventData = firstRef.events;
      }
    }

    return NextResponse.json({
      leaderboard,
      event: eventData,
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
