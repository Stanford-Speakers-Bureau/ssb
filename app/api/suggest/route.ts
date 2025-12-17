import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSupabaseClient,
} from "@/app/lib/supabase";
import { SUGGEST_MESSAGES } from "@/app/lib/constants";
import { checkRateLimit, suggestRatelimit } from "@/app/lib/ratelimit";

const MIN_SPEAKER_LENGTH = 2;
const MAX_SPEAKER_LENGTH = 500;

/**
 * Sanitize input by removing control characters and normalizing whitespace
 */
function sanitizeInput(input: string): string {
  return (
    input
      // Remove control characters (except newline and tab)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Normalize multiple spaces/newlines to single space
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Capitalize the first letter of each word
 */
function toTitleCase(input: string): string {
  return input
    .split(" ")
    .map((word) =>
      word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "",
    )
    .join(" ");
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user - this verifies the session token server-side
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    // Check if user is banned
    const adminClient = getSupabaseClient();
    const { data: userRole } = await adminClient
      .from("roles")
      .select("roles")
      .eq("email", user.email)
      .single();

    if (userRole?.roles?.split(",").includes("banned")) {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_BANNED },
        { status: 403 },
      );
    }

    // Rate limit by user email (more restrictive for suggestions)
    const rateLimitResponse = await checkRateLimit(
      suggestRatelimit,
      `suggest:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { speaker } = body;

    // Validate input type
    if (!speaker || typeof speaker !== "string") {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_MISSING_SPEAKER },
        { status: 400 },
      );
    }

    // Sanitize and validate input
    const sanitizedSpeaker = sanitizeInput(speaker);

    if (sanitizedSpeaker.length < MIN_SPEAKER_LENGTH) {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_MISSING_SPEAKER },
        { status: 400 },
      );
    }

    if (sanitizedSpeaker.length > MAX_SPEAKER_LENGTH) {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_TOO_LONG },
        { status: 400 },
      );
    }

    // Format speaker name with title case
    const formattedSpeaker = toTitleCase(sanitizedSpeaker);

    // Support comma-separated speakers: split, trim, filter empty, and deduplicate
    const speakers = [
      ...new Set(
        formattedSpeaker
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];

    if (speakers.length === 0) {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_MISSING_SPEAKER },
        { status: 400 },
      );
    }

    // Check for existing suggestions from this user to prevent duplicates
    const { data: existingSuggestions, error: checkError } = await adminClient
      .from("suggest")
      .select("speaker")
      .eq("email", user.email);

    if (checkError) {
      console.error("Error checking existing suggestions:", checkError);
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_GENERIC },
        { status: 500 },
      );
    }

    const existingSpeakers = new Set(
      existingSuggestions?.map((s) => s.speaker) || [],
    );

    // Filter out speakers that have already been suggested by this user
    const newSpeakers = speakers.filter(
      (speaker) => !existingSpeakers.has(speaker),
    );

    if (newSpeakers.length === 0) {
      return NextResponse.json(
        { error: "You have already suggested all of these speakers." },
        { status: 400 },
      );
    }

    // Insert all new speakers and cast a vote for each
    for (const speakerName of newSpeakers) {
      // Insert suggestion using admin client (to bypass RLS) and return its id
      const { data: suggestion, error: suggestError } = await adminClient
        .from("suggest")
        .insert([
          {
            email: user.email,
            speaker: speakerName,
            approved: false,
            reviewed: false,
            votes: 0,
          },
        ])
        .select("id")
        .single();

      if (suggestError || !suggestion) {
        console.error("Suggest insert error:", suggestError);
        return NextResponse.json(
          { error: SUGGEST_MESSAGES.ERROR_GENERIC },
          { status: 500 },
        );
      }

      // Automatically create an initial vote for the suggester
      const { error: voteError } = await adminClient.from("votes").insert([
        {
          speaker_id: suggestion.id,
          email: user.email,
        },
      ]);

      if (voteError) {
        console.error("Initial vote insert error:", voteError);
        // Suggestion was created successfully; vote is a best-effort enhancement
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Suggest error:", error);
    return NextResponse.json(
      { error: SUGGEST_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}
