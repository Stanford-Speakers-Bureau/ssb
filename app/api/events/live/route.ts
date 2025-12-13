import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/app/lib/supabase";

/**
 * Public endpoint to check if there's a live event
 * Used by frontend components to determine if ticket cancellation should be disabled
 */
export async function GET(req: Request) {
  try {
    const adminClient = getSupabaseClient();

    // Get the live event
    const { data: liveEvent, error: liveEventError } = await adminClient
      .from("events")
      .select("id, name")
      .eq("live", true)
      .single();

    if (liveEventError || !liveEvent) {
      return NextResponse.json({ isLive: false, liveEvent: null }, { status: 200 });
    }

    return NextResponse.json(
      {
        isLive: true,
        liveEvent: {
          id: liveEvent.id,
          name: liveEvent.name,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Live event fetch error:", error);
    return NextResponse.json(
      { isLive: false, liveEvent: null },
      { status: 200 },
    );
  }
}

