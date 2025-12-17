import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSupabaseClient,
} from "@/app/lib/supabase";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in." },
        { status: 401 },
      );
    }

    const adminClient = getSupabaseClient();

    // Get all tickets for this user with event information
    const { data: tickets, error } = await adminClient
      .from("tickets")
      .select(
        `
        id,
        event_id,
        created_at,
        type,
        events (
          id,
          name,
          route,
          start_time_date,
          venue
        )
      `,
      )
      .eq("email", user.email)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user tickets:", error);
      return NextResponse.json(
        { error: "Failed to fetch tickets" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        tickets: tickets || [],
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Ticket fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
