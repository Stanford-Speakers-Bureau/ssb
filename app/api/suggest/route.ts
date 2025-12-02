import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSupabaseClient } from "../../lib/supabase";
import { SUGGEST_MESSAGES } from "../../lib/constants";
import { suggestRatelimit, checkRateLimit } from "../../lib/ratelimit";

const MIN_SPEAKER_LENGTH = 2;
const MAX_SPEAKER_LENGTH = 500;

/**
 * Sanitize input by removing control characters and normalizing whitespace
 */
function sanitizeInput(input: string): string {
  return input
    // Remove control characters (except newline and tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Normalize multiple spaces/newlines to single space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Capitalize the first letter of each word
 */
function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user - this verifies the session token server-side
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 }
      );
    }

    // Check if user is banned
    const adminClient = getSupabaseClient();
    const { data: banRecord } = await adminClient
      .from("bans")
      .select("email")
      .eq("email", user.email)
      .single();

    if (banRecord) {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_BANNED },
        { status: 403 }
      );
    }

    // Rate limit by user email (more restrictive for suggestions)
    const rateLimitResponse = await checkRateLimit(
      suggestRatelimit,
      `suggest:${user.email}`
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { speaker } = body;

    // Validate input type
    if (!speaker || typeof speaker !== "string") {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_MISSING_SPEAKER },
        { status: 400 }
      );
    }

    // Sanitize and validate input
    const sanitizedSpeaker = sanitizeInput(speaker);
    
    if (sanitizedSpeaker.length < MIN_SPEAKER_LENGTH) {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_MISSING_SPEAKER },
        { status: 400 }
      );
    }

    if (sanitizedSpeaker.length > MAX_SPEAKER_LENGTH) {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_TOO_LONG },
        { status: 400 }
      );
    }

    // Format speaker name with title case
    const formattedSpeaker = toTitleCase(sanitizedSpeaker);

    // Insert suggestion using admin client (to bypass RLS) and return its id
    const { data: suggestion, error: suggestError } = await adminClient
      .from("suggest")
      .insert([{ 
        email: user.email, 
        speaker: formattedSpeaker,
        approved: false,
        reviewed: false,
        votes: 0,
      }])
      .select("id")
      .single();

    if (suggestError || !suggestion) {
      console.error("Suggest insert error:", suggestError);
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_GENERIC },
        { status: 500 }
      );
    }

    // Automatically create an initial vote for the suggester
    const { error: voteError } = await adminClient
      .from("votes")
      .insert([{
        speaker_id: suggestion.id,
        email: user.email,
      }]);

    if (voteError) {
      console.error("Initial vote insert error:", voteError);
      // Suggestion was created successfully; vote is a best-effort enhancement
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Suggest error:", error);
    return NextResponse.json(
      { error: SUGGEST_MESSAGES.ERROR_GENERIC },
      { status: 500 }
    );
  }
}

