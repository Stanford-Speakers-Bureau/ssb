import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  updateReferralRecords,
  getSupabaseClient,
} from "../../lib/supabase";
import { generateReferralCode } from "../../lib/utils";

/**
 * POST /api/referrals
 * Creates or updates a referral record when a ticket is created.
 * 
 * Body: { event_id: string }
 * 
 * Creates/ensures a referral record exists for the current user's referral code.
 * Skips if the referral code used is the user's own referral code.
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

    const { event_id } = body;

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: "Missing required field: event_id" },
        { status: 400 },
      );
    }

    // Get the ticket to check what referral code was used
    const adminClient = getSupabaseClient();
    const { data: ticket } = await adminClient
      .from("tickets")
      .select("referral")
      .eq("event_id", event_id)
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Check if the referral code used is the user's own referral code
    if (ticket?.referral) {
      const userReferralCode = generateReferralCode(user.email);
      if (ticket.referral === userReferralCode) {
        // Don't count self-referrals
        return NextResponse.json(
          {
            success: true,
            message: "Self-referral detected, skipping referral record update",
          },
          { status: 200 },
        );
      }
    }

    // Update referral records
    await updateReferralRecords(event_id, user.email);

    return NextResponse.json(
      {
        success: true,
        message: "Referral record updated",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Referral API error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

