import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSupabaseClient } from "../../lib/supabase";
import { NOTIFY_MESSAGES } from "../../lib/constants";
import { notifyRatelimit, checkRateLimit } from "../../lib/ratelimit";

export async function POST(req: Request) {
  try {
    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { speaker_id } = body;

    // Validate input type
    if (!speaker_id || typeof speaker_id !== "string") {
      return NextResponse.json(
        { error: NOTIFY_MESSAGES.ERROR_MISSING_SPEAKER_ID },
        { status: 400 }
      );
    }

    // Verify event exists using admin client
    const adminClient = getSupabaseClient();
    const { data: event, error: eventError } = await adminClient
      .from("events")
      .select("id")
      .eq("id", speaker_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: NOTIFY_MESSAGES.ERROR_EVENT_NOT_FOUND },
        { status: 404 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: NOTIFY_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 }
      );
    }

    // Rate limit by user email
    const rateLimitResponse = await checkRateLimit(
      notifyRatelimit,
      `notify:${user.email}`
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Check if notification signup already exists
    const { data: existingNotify } = await adminClient
      .from("notify")
      .select("id")
      .eq("email", user.email)
      .eq("speaker_id", speaker_id)
      .single();

    if (existingNotify) {
      return NextResponse.json(
        { error: NOTIFY_MESSAGES.ALREADY_SIGNED_UP },
        { status: 409 }
      );
    }

    // Insert notification signup
    const { error } = await adminClient
      .from("notify")
      .insert([{ email: user.email, speaker_id }]);

    if (error) {
      return NextResponse.json({ error: NOTIFY_MESSAGES.ERROR_GENERIC }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: NOTIFY_MESSAGES.ERROR_GENERIC }, { status: 500 });
  }
}
