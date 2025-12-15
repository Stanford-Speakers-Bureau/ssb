import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSupabaseClient,
} from "../../../lib/supabase";
import { generateReferralCode } from "../../../lib/utils";

/**
 * POST /api/referrals/validate
 * Validates a referral code for the current user and event.
 * 
 * Body: { referral_code: string, event_id: string }
 * 
 * Returns:
 * - { valid: true } if the referral code is valid and not the user's own
 * - { valid: false, reason: "self_referral" } if it's the user's own referral code
 * - { valid: false, reason: "invalid" } if the referral code doesn't exist for this event
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
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

    // Parse request body
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

    // Check if it's the user's own referral code
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

    // Check if the referral code exists for this event
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

    return NextResponse.json(
      {
        valid: true,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Referral validation error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

