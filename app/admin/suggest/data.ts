import type { Suggestion } from "./AdminSuggestClient";
import { verifyAdminRequest } from "@/app/lib/supabase";

export async function getAdminSuggestions(): Promise<{
  suggestions: Suggestion[];
}> {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return { suggestions: [] };
    }

    const client = auth.adminClient!;

    // Fetch all suggestions, newest first
    const { data: suggestions, error } = await client
      .from("suggest")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Suggestions fetch error:", error);
      return { suggestions: [] };
    }

    // Attach voters for each suggestion (admin-only view)
    let suggestionsWithVoters = suggestions || [];
    try {
      const suggestionIds = (suggestions || [])
        .map((s: any) => s.id)
        .filter(Boolean);

      if (suggestionIds.length > 0) {
        const { data: votes, error: votesError } = await client
          .from("votes")
          .select("speaker_id, email")
          .in("speaker_id", suggestionIds);

        if (votesError) {
          console.error("Votes fetch error:", votesError);
        } else {
          const votersBySpeaker: Record<string, string[]> = {};
          for (const vote of votes || []) {
            const key = vote.speaker_id as string;
            if (!votersBySpeaker[key]) votersBySpeaker[key] = [];
            votersBySpeaker[key].push(vote.email);
          }

          suggestionsWithVoters = (suggestions || []).map((s: any) => ({
            ...s,
            voters: votersBySpeaker[s.id] || [],
          }));
        }
      }
    } catch (votesError) {
      console.error("Unexpected error attaching voters:", votesError);
    }

    return {
      suggestions: suggestionsWithVoters as Suggestion[],
    };
  } catch (error) {
    console.error("Failed to fetch initial suggestions:", error);
    return { suggestions: [] };
  }
}
