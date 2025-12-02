import { NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../lib/supabase";

export async function GET() {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Get all events
    const { data: events, error: eventsError } = await auth.adminClient!
      .from("events")
      .select("id, name, start_time_date")
      .order("start_time_date", { ascending: false });

    if (eventsError) {
      console.error("Events fetch error:", eventsError);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    // Get all notifications
    const { data: notifications, error: notifyError } = await auth.adminClient!
      .from("notify")
      .select("id, email, created_at, speaker_id")
      .order("created_at", { ascending: false });

    if (notifyError) {
      console.error("Notifications fetch error:", notifyError);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    // Group notifications by event
    const eventsWithNotifications = events?.map((event) => ({
      ...event,
      notifications: notifications?.filter((n) => n.speaker_id === event.id) || [],
    })) || [];

    return NextResponse.json({ events: eventsWithNotifications });
  } catch (error) {
    console.error("Notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

