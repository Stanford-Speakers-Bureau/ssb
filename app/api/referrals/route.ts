import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSupabaseClient,
} from "../../lib/supabase";
import { generateReferralCode } from "../../lib/utils";

/**
 * GET /api/referrals
 * Gets the referral count for the authenticated user's referral code and event.
 * Users can only view their own referral count.
 * 
 * Query params: { event_id: string }
 */
export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user - require authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("event_id");

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing required query parameter: event_id" },
        { status: 400 },
      );
    }

    // Generate the user's referral code from their email
    const userReferralCode = generateReferralCode(user.email);

    if (!userReferralCode) {
      return NextResponse.json(
        { error: "Unable to generate referral code" },
        { status: 500 },
      );
    }

    // Only query for the authenticated user's referral code
    const adminClient = getSupabaseClient();
    const { data, error } = await adminClient
      .from("referrals")
      .select("count")
      .eq("event_id", eventId)
      .eq("referral_code", userReferralCode)
      .single();

    if (error) {
      // If no record found, return 0 count
      if (error.code === "PGRST116") {
        return NextResponse.json({ count: 0 }, { status: 200 });
      }
      return NextResponse.json(
        { error: "Failed to fetch referral count" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { count: data?.count ?? 0 },
      { status: 200 },
    );
  } catch (error) {
    console.error("Referral GET API error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
