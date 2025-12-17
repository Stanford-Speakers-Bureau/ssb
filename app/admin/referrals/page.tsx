import ReferralLeaderboardClient from "./ReferralLeaderboardClient";
import { verifyAdminRequest } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

async function getInitialLeaderboard() {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return { leaderboard: [], isGrouped: true };
    }

    const client = auth.adminClient!;

    const { data: referrals, error } = await client
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

    if (error) {
      console.error("Referrals fetch error:", error);
      return { leaderboard: [], isGrouped: true };
    }

    // Group by event
    const groupedByEvent: Record<
      string,
      {
        event: { id: string; name: string | null; route: string | null };
        referrals: Array<{ referral_code: string; count: number }>;
      }
    > = {};

    referrals?.forEach((ref) => {
      const eventId = ref.event_id;
      if (!eventId) return;

      // Handle events relation - Supabase may return it as array or object
      let eventData: {
        id: string;
        name: string | null;
        route: string | null;
        start_time_date: string | null;
      } | null = null;

      if (Array.isArray(ref.events)) {
        eventData = ref.events[0] || null;
      } else if (ref.events) {
        eventData = ref.events as typeof eventData;
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

    return {
      leaderboard: Object.values(groupedByEvent),
      isGrouped: true,
    };
  } catch (error) {
    console.error("Failed to fetch initial leaderboard:", error);
    return { leaderboard: [], isGrouped: true };
  }
}

async function getEvents() {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return [];
    }

    const client = auth.adminClient!;

    const { data: events, error } = await client
      .from("events")
      .select("id, name")
      .order("start_time_date", { ascending: false });

    if (error) {
      console.error("Events fetch error:", error);
      return [];
    }

    return events || [];
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return [];
  }
}

export default async function AdminReferralsPage() {
  const [{ leaderboard, isGrouped }, events] = await Promise.all([
    getInitialLeaderboard(),
    getEvents(),
  ]);

  return (
    <ReferralLeaderboardClient
      initialLeaderboard={leaderboard}
      initialEvents={events}
      isGrouped={isGrouped}
    />
  );
}
