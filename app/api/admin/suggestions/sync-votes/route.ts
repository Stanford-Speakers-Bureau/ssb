import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/app/lib/supabase";
import { getAdminSuggestions } from "@/app/admin/suggest/data";
import { getSupabaseClient } from "@/app/lib/supabase";

export async function POST() {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const adminClient = getSupabaseClient();

    // Call the sync_votes RPC function
    const { data, error } = await adminClient.rpc("sync_votes");

    if (error) {
      console.error("Sync votes RPC error:", error);
      // Check if function doesn't exist
      if (error.code === "42883") {
        return NextResponse.json(
          {
            error:
              "Sync votes RPC function is not installed. Please run sync_votes_function.sql in your database.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: "Failed to sync votes" },
        { status: 500 },
      );
    }

    // Return fresh suggestions using the same logic as the initial page load
    const { suggestions } = await getAdminSuggestions();
    return NextResponse.json({
      success: true,
      suggestions,
      updatedCount: data || 0,
    });
  } catch (error) {
    console.error("Sync votes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
