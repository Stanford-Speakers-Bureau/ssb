import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { getAdminSuggestions } from "@/app/suggest/data";
import { db, eq, suggest } from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";

export async function PATCH(req: Request) {
  try {
    const auth = await requirePermission("suggestions.manage");
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

    // Verify the suggestion exists
    const suggestion = await db.query.suggest.findFirst({
      where: eq(suggest.id, speaker_id),
      columns: { id: true, speaker: true, votes: true },
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: "Speaker suggestion not found" },
        { status: 404 },
      );
    }

    // Update the vote count directly
    await db.update(suggest)
      .set({ votes })
      .where(eq(suggest.id, speaker_id));

    await logAuditEvent({
      action: "suggestion.edit_votes",
      actor: auth.email!,
      metadata: {
        suggestionId: speaker_id,
        speaker: suggestion.speaker,
        oldVotes: suggestion.votes,
        newVotes: votes,
      },
    });

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
