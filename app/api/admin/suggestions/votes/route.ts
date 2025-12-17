import { NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../../lib/supabase";
import { getAdminSuggestions } from "../../../../admin/suggest/data";

export async function PATCH(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { speaker_id, votes } = body;

    if (
      !speaker_id ||
      typeof speaker_id !== "string" ||
      typeof votes !== "number" ||
      votes < 0 ||
      !Number.isInteger(votes)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid request: speaker_id and votes (non-negative integer) are required",
        },
        { status: 400 },
      );
    }

    const client = auth.adminClient!;

    // Verify the suggestion exists
    const { data: suggestion, error: suggestionError } = await client
      .from("suggest")
      .select("id")
      .eq("id", speaker_id)
      .single();

    if (suggestionError || !suggestion) {
      return NextResponse.json(
        { error: "Speaker suggestion not found" },
        { status: 404 },
      );
    }

    // Update the vote count directly
    const { error: updateError } = await client
      .from("suggest")
      .update({ votes })
      .eq("id", speaker_id);

    if (updateError) {
      console.error("Vote count update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update vote count" },
        { status: 500 },
      );
    }

    // Return fresh suggestions
    const { suggestions } = await getAdminSuggestions();
    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    console.error("Update vote count error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
