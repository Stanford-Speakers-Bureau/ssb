import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/app/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const event_id = searchParams.get("event_id");

    if (!event_id) {
      return NextResponse.json(
        { error: "Missing required field: event_id" },
        { status: 400 },
      );
    }

    const adminClient = getSupabaseClient();

    // Count tickets for this event
    const { count, error } = await adminClient
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event_id);

    if (error) {
      console.error("Ticket count error:", error);
      return NextResponse.json(
        { error: "Failed to fetch ticket count" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        count: count ?? 0,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Ticket count error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

