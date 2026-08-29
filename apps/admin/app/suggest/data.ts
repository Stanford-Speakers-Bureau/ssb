import type { Suggestion } from "./AdminSuggestClient";
import { getSessionUser } from "@/app/lib/auth";
import { hasPermission } from "@/app/lib/permissions";
import { db, inArray, votes } from "@ssb/db";

export async function getAdminSuggestions(): Promise<{
  suggestions: Suggestion[];
}> {
  try {
    const user = await getSessionUser();
    if (!user?.email || !(await hasPermission(user.email, "suggestions.manage"))) {
      return { suggestions: [] };
    }

    // Fetch all suggestions, newest first
    const suggestions = await db.query.suggest.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    // Attach voters for each suggestion (admin-only view)
    let suggestionsWithVoters: Suggestion[] = suggestions.map((s) => ({
      id: s.id,
      created_at: s.createdAt.toISOString(),
      email: s.email ?? "",
      speaker: s.speaker ?? "",
      approved: !!s.approved,
      votes: s.votes ?? 0,
      reviewed: !!s.reviewed,
      duplicate: !!s.duplicate,
      spoke: !!s.spoke,
      eventLink: s.eventLink ?? null,
      voters: [],
    }));
    try {
      const suggestionIds = suggestions.map((s) => s.id).filter(Boolean);

      if (suggestionIds.length > 0) {
        const allVotes = await db.query.votes.findMany({
          where: inArray(votes.speakerId, suggestionIds),
          columns: { speakerId: true, email: true },
        });

        const votersBySpeaker: Record<string, string[]> = {};
        for (const vote of allVotes) {
          const key = vote.speakerId as string;
          if (!votersBySpeaker[key]) votersBySpeaker[key] = [];
          if (vote.email) votersBySpeaker[key].push(vote.email);
        }

        suggestionsWithVoters = suggestions.map((s) => ({
          id: s.id,
          created_at: s.createdAt.toISOString(),
          email: s.email ?? "",
          speaker: s.speaker ?? "",
          approved: !!s.approved,
          votes: s.votes ?? 0,
          reviewed: !!s.reviewed,
          duplicate: !!s.duplicate,
          spoke: !!s.spoke,
          eventLink: s.eventLink ?? null,
          voters: votersBySpeaker[s.id] || [],
        }));
      }
    } catch (votesError) {
      console.error("Unexpected error attaching voters:", votesError);
    }

    return {
      suggestions: suggestionsWithVoters,
    };
  } catch (error) {
    console.error("Failed to fetch initial suggestions:", error);
    return { suggestions: [] };
  }
}
