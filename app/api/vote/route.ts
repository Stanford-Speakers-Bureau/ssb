import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSupabaseClient } from "../../lib/supabase";
import { voteRatelimit, checkRateLimit } from "../../lib/ratelimit";

export const VOTE_MESSAGES = {
  SUCCESS: "Vote recorded!",
  REMOVED: "Vote removed.",
  ALREADY_VOTED: "You've already voted for this speaker.",
  NOT_VOTED: "You haven't voted for this speaker.",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in with Google.",
  ERROR_MISSING_SPEAKER_ID: "Missing required field: speaker_id",
  ERROR_SPEAKER_NOT_FOUND: "Speaker suggestion not found.",
} as const;

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 }
      );
    }

    // Rate limit by user email
    const rateLimitResponse = await checkRateLimit(
      voteRatelimit,
      `vote:${user.email}`
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { speaker_id } = body;

    if (!speaker_id || typeof speaker_id !== "string") {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_MISSING_SPEAKER_ID },
        { status: 400 }
      );
    }

    const adminClient = getSupabaseClient();

    // Check if the speaker suggestion exists and is approved
    const { data: suggestion, error: suggestionError } = await adminClient
      .from("suggest")
      .select("id, votes")
      .eq("id", speaker_id)
      .eq("approved", true)
      .single();

    if (suggestionError || !suggestion) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_SPEAKER_NOT_FOUND },
        { status: 404 }
      );
    }

    // Check if user has already voted for this speaker
    const { data: existingVote } = await adminClient
      .from("votes")
      .select("id")
      .eq("speaker_id", speaker_id)
      .eq("email", user.email)
      .single();

    if (existingVote) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ALREADY_VOTED, alreadyVoted: true },
        { status: 400 }
      );
    }

    // Insert the vote
    const { error: voteError } = await adminClient
      .from("votes")
      .insert([{
        speaker_id,
        email: user.email,
      }]);

    if (voteError) {
      console.error("Vote insert error:", voteError);
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_GENERIC },
        { status: 500 }
      );
    }

    // Fetch updated vote count from suggest table (kept in sync via DB triggers)
    const { data: updatedSuggestion, error: updatedSuggestionError } = await adminClient
      .from("suggest")
      .select("votes")
      .eq("id", speaker_id)
      .single();

    if (updatedSuggestionError) {
      console.error("Failed to fetch updated vote count:", updatedSuggestionError);
    }

    const newVoteCount = updatedSuggestion?.votes ?? (suggestion.votes || 0) + 1;

    return NextResponse.json({ 
      success: true, 
      message: VOTE_MESSAGES.SUCCESS,
      newVoteCount 
    }, { status: 200 });

  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json(
      { error: VOTE_MESSAGES.ERROR_GENERIC },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 }
      );
    }

    // Rate limit by user email
    const rateLimitResponse = await checkRateLimit(
      voteRatelimit,
      `vote:${user.email}`
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { speaker_id } = body;

    if (!speaker_id || typeof speaker_id !== "string") {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_MISSING_SPEAKER_ID },
        { status: 400 }
      );
    }

    const adminClient = getSupabaseClient();

    // Check if the speaker suggestion exists
    const { data: suggestion, error: suggestionError } = await adminClient
      .from("suggest")
      .select("id, votes")
      .eq("id", speaker_id)
      .single();

    if (suggestionError || !suggestion) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_SPEAKER_NOT_FOUND },
        { status: 404 }
      );
    }

    // Check if user has voted for this speaker
    const { data: existingVote } = await adminClient
      .from("votes")
      .select("id")
      .eq("speaker_id", speaker_id)
      .eq("email", user.email)
      .single();

    if (!existingVote) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.NOT_VOTED },
        { status: 400 }
      );
    }

    // Delete the vote
    const { error: deleteError } = await adminClient
      .from("votes")
      .delete()
      .eq("speaker_id", speaker_id)
      .eq("email", user.email);

    if (deleteError) {
      console.error("Vote delete error:", deleteError);
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_GENERIC },
        { status: 500 }
      );
    }

    // Fetch updated vote count from suggest table (kept in sync via DB triggers)
    const { data: updatedSuggestion, error: updatedSuggestionError } = await adminClient
      .from("suggest")
      .select("votes")
      .eq("id", speaker_id)
      .single();

    if (updatedSuggestionError) {
      console.error("Failed to fetch updated vote count:", updatedSuggestionError);
    }

    const newVoteCount = updatedSuggestion?.votes ?? Math.max((suggestion.votes || 0) - 1, 0);

    return NextResponse.json({ 
      success: true, 
      message: VOTE_MESSAGES.REMOVED,
      newVoteCount 
    }, { status: 200 });

  } catch (error) {
    console.error("Unvote error:", error);
    return NextResponse.json(
      { error: VOTE_MESSAGES.ERROR_GENERIC },
      { status: 500 }
    );
  }
}

