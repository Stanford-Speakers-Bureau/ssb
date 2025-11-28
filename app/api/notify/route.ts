import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSupabaseClient } from "../../lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { speaker_id } = body;

    if (!speaker_id) {
      return NextResponse.json(
        { error: "Missing required field: speaker_id" },
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
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in with Google." },
        { status: 401 }
      );
    }

    // Check if notification signup already exists
    const { data: existingNotify } = await adminClient
      .from("notify")
      .select("id")
      .eq("email", user.email)
      .eq("speaker_id", speaker_id)
      .single();

    if (existingNotify) {
      return NextResponse.json(
        { error: "You're already signed up for notifications for this event!" },
        { status: 409 }
      );
    }

    // Insert notification signup
    const { data, error } = await adminClient
      .from("notify")
      .insert([{ email: user.email, speaker_id }])
      .select();

    if (error) {
      console.error("Error inserting into notify table:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in notify route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
