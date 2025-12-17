import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSupabaseClient,
  verifyAdminRequest,
} from "@/app/lib/supabase";
import { generateReferralCode } from "@/app/lib/utils";
import { checkRateLimit, referralValidateRatelimit } from "@/app/lib/ratelimit";

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

/**
 * GET /api/referrals
 *
 * If Admin: Returns leaderboard data.
 * If User: Returns referral count for authenticated user.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || searchParams.get("event_id");

    // 1. Check if Admin
    const auth = await verifyAdminRequest();
    if (auth.authorized) {
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

          // Handle events relation
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

        // Sort referrals within each event
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
    }

    // 2. If Not Admin, Handle User Request
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing required query parameter: event_id" },
        { status: 400 },
      );
    }

    const userReferralCode = generateReferralCode(user.email);
    if (!userReferralCode) {
      return NextResponse.json(
        { error: "Unable to generate referral code" },
        { status: 500 },
      );
    }

    const adminClient = getSupabaseClient();
    const { data, error } = await adminClient
      .from("referrals")
      .select("count")
      .eq("event_id", eventId)
      .eq("referral_code", userReferralCode)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ count: 0 }, { status: 200 });
      }
      return NextResponse.json(
        { error: "Failed to fetch referral count" },
        { status: 500 },
      );
    }

    return NextResponse.json({ count: data?.count ?? 0 }, { status: 200 });
  } catch (error) {
    console.error("Referral API error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/referrals
 * Validates a referral code.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const rateLimitResponse = await checkRateLimit(
      referralValidateRatelimit,
      `referral-validate:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { referral_code, event_id } = body;

    if (!referral_code || typeof referral_code !== "string") {
      return NextResponse.json(
        { error: "Missing required field: referral_code" },
        { status: 400 },
      );
    }

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: "Missing required field: event_id" },
        { status: 400 },
      );
    }

    const userReferralCode = generateReferralCode(user.email);

    if (referral_code.trim() === userReferralCode) {
      return NextResponse.json(
        {
          valid: false,
          reason: "self_referral",
          message: "You cannot use your own referral code",
        },
        { status: 200 },
      );
    }

    const adminClient = getSupabaseClient();
    const { data, error } = await adminClient
      .from("referrals")
      .select("id")
      .eq("event_id", event_id)
      .eq("referral_code", referral_code.trim())
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          valid: false,
          reason: "invalid",
          message: "Invalid referral code for this event",
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (error) {
    console.error("Referral validation error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
