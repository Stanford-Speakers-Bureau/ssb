import { NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../lib/supabase";

const MIN_SPEAKER_LENGTH = 2;
const MAX_SPEAKER_LENGTH = 500;

function sanitizeInput(input: string): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "pending";
    const includeLeaderboard =
      searchParams.get("leaderboard") === "1" || searchParams.get("leaderboard") === "true";

    let query = auth.adminClient!.from("suggest").select("*");

    switch (filter) {
      case "pending":
        query = query.eq("reviewed", false);
        break;
      case "approved":
        query = query.eq("reviewed", true).eq("approved", true);
        break;
      case "rejected":
        query = query.eq("reviewed", true).eq("approved", false);
        break;
      // "all" - no filter
    }

    // Sort results: approved suggestions by most votes, others by newest first.
    if (filter === "approved") {
      query = query.order("votes", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data: suggestions, error } = await query;

    if (error) {
      console.error("Suggestions fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
    }

    // Attach voters for each suggestion (admin-only view)
    let suggestionsWithVoters = suggestions || [];
    try {
      const suggestionIds = (suggestions || []).map((s: any) => s.id).filter(Boolean);

      if (suggestionIds.length > 0) {
        const { data: votes, error: votesError } = await auth.adminClient!
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

    // Optionally include a global leaderboard (top approved suggestions by votes)
    let leaderboard:
      | {
          id: string;
          speaker: string;
          votes: number;
          voters: string[];
        }[]
      | undefined;
    if (includeLeaderboard) {
      const { data: leaderboardData, error: leaderboardError } = await auth.adminClient!
        .from("suggest")
        .select("id, speaker, votes")
        .eq("approved", true)
        .order("votes", { ascending: false })
        .limit(10);

      if (leaderboardError) {
        console.error("Leaderboard fetch error:", leaderboardError);
      } else {
        const baseLeaderboard = leaderboardData || [];

        // Attach voters for leaderboard entries
        try {
          const speakerIds = baseLeaderboard.map((s: any) => s.id).filter(Boolean);

          if (speakerIds.length > 0) {
            const { data: lbVotes, error: lbVotesError } = await auth.adminClient!
              .from("votes")
              .select("speaker_id, email")
              .in("speaker_id", speakerIds);

            if (lbVotesError) {
              console.error("Leaderboard votes fetch error:", lbVotesError);
              leaderboard = baseLeaderboard.map((s: any) => ({
                ...s,
                voters: [],
              }));
            } else {
              const votersBySpeaker: Record<string, string[]> = {};
              for (const vote of lbVotes || []) {
                const key = vote.speaker_id as string;
                if (!votersBySpeaker[key]) votersBySpeaker[key] = [];
                votersBySpeaker[key].push(vote.email);
              }

              leaderboard = baseLeaderboard.map((s: any) => ({
                ...s,
                voters: votersBySpeaker[s.id] || [],
              }));
            }
          } else {
            leaderboard = [];
          }
        } catch (lbError) {
          console.error("Unexpected error attaching leaderboard voters:", lbError);
          leaderboard = baseLeaderboard.map((s: any) => ({
            ...s,
            voters: [],
          }));
        }
      }
    }

    return NextResponse.json({
      suggestions: suggestionsWithVoters,
      ...(includeLeaderboard ? { leaderboard: leaderboard || [] } : {}),
    });
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { id, action } = body;

    if (!id || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { error } = await auth.adminClient!
      .from("suggest")
      .update({
        reviewed: true,
        approved: action === "approve",
      })
      .eq("id", id);

    if (error) {
      console.error("Suggestion update error:", error);
      return NextResponse.json({ error: "Failed to update suggestion" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Suggestion action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { id, speaker } = body;

    if (!id || typeof speaker !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const sanitizedSpeaker = sanitizeInput(speaker);

    if (sanitizedSpeaker.length < MIN_SPEAKER_LENGTH) {
      return NextResponse.json(
        { error: "Speaker name is too short." },
        { status: 400 }
      );
    }

    if (sanitizedSpeaker.length > MAX_SPEAKER_LENGTH) {
      return NextResponse.json(
        { error: "Speaker name is too long." },
        { status: 400 }
      );
    }

    const formattedSpeaker = toTitleCase(sanitizedSpeaker);

    const { error } = await auth.adminClient!
      .from("suggest")
      .update({ speaker: formattedSpeaker })
      .eq("id", id);

    if (error) {
      console.error("Suggestion edit error:", error);
      return NextResponse.json(
        { error: "Failed to update suggestion" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, speaker: formattedSpeaker });
  } catch (error) {
    console.error("Suggestion edit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

