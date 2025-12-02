import { NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../lib/supabase";

export async function GET() {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Get stats
    const [
      { count: pendingSuggestions },
      { count: totalEvents },
      { count: totalNotifications },
      { count: totalUsers },
      { count: totalBans },
    ] = await Promise.all([
      auth.adminClient.from("suggest").select("*", { count: "exact", head: true }).eq("reviewed", false),
      auth.adminClient.from("events").select("*", { count: "exact", head: true }),
      auth.adminClient.from("notify").select("*", { count: "exact", head: true }),
      auth.adminClient.from("admins").select("*", { count: "exact", head: true }),
      auth.adminClient.from("bans").select("*", { count: "exact", head: true }),
    ]);

    return NextResponse.json({
      pendingSuggestions: pendingSuggestions ?? 0,
      totalEvents: totalEvents ?? 0,
      totalNotifications: totalNotifications ?? 0,
      totalUsers: totalUsers ?? 0,
      totalBans: totalBans ?? 0,
    });
  } catch (error) {
    console.error("Stats fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

