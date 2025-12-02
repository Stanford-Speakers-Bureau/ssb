import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSupabaseClient } from "../../lib/supabase";
import { SUGGEST_MESSAGES } from "../../lib/constants";

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

    // Insert suggestion using admin client (to bypass RLS)
    const adminClient = getSupabaseClient();
    const { error } = await adminClient
      .from("suggest")
      .insert([{ 
        email: user.email, 
        speaker: sanitizedSpeaker 
      }]);

    if (error) {
      return NextResponse.json(
        { error: SUGGEST_MESSAGES.ERROR_GENERIC },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: SUGGEST_MESSAGES.ERROR_GENERIC },
      { status: 500 }
    );
  }
}

