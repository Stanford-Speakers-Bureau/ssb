import { NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../lib/supabase";
import { getAdminSuggestions } from "../../../admin/suggest/data";

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

    // Return fresh suggestions using the same logic as the initial page load
    const { suggestions } = await getAdminSuggestions();
    return NextResponse.json({ success: true, suggestions });
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
    const { id, speaker, duplicate } = body;

    if (!id) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Handle marking as duplicate
    if (typeof duplicate === "boolean") {
      const { error } = await auth.adminClient!
        .from("suggest")
        .update({ duplicate })
        .eq("id", id);

      if (error) {
        console.error("Suggestion duplicate update error:", error);
        return NextResponse.json(
          { error: "Failed to update suggestion" },
          { status: 500 }
        );
      }

      // Return fresh suggestions using the same logic as the initial page load
      const { suggestions } = await getAdminSuggestions();
      return NextResponse.json({ success: true, suggestions });
    }

    // Handle updating speaker name
    if (typeof speaker !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { error } = await auth.adminClient!
      .from("suggest")
      .update({ speaker: speaker })
      .eq("id", id);

    if (error) {
      console.error("Suggestion edit error:", error);
      return NextResponse.json(
        { error: "Failed to update suggestion" },
        { status: 500 }
      );
    }

    // Return fresh suggestions using the same logic as the initial page load
    const { suggestions } = await getAdminSuggestions();
    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    console.error("Suggestion edit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { sourceId, targetId } = body;

    if (!sourceId || !targetId || typeof sourceId !== "string" || typeof targetId !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const client = auth.adminClient!;

    // Verify source is pending or rejected (not approved) and target is approved
    const { data: source, error: sourceError } = await client
      .from("suggest")
      .select("id, reviewed, approved")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source || source.approved) {
      return NextResponse.json(
        { error: "Source suggestion must be pending or rejected" },
        { status: 400 }
      );
    }

    const { data: target, error: targetError } = await client
      .from("suggest")
      .select("id, approved")
      .eq("id", targetId)
      .single();

    if (targetError || !target || !target.approved) {
      return NextResponse.json(
        { error: "Target suggestion must be approved" },
        { status: 400 }
      );
    }

    // Get all votes from the source suggestion
    const { data: sourceVotes, error: votesError } = await client
      .from("votes")
      .select("email")
      .eq("speaker_id", sourceId);

    if (votesError) {
      console.error("Failed to fetch source votes:", votesError);
      return NextResponse.json(
        { error: "Failed to fetch source votes" },
        { status: 500 }
      );
    }

    // Get existing votes for the target to avoid duplicates
    const { data: targetVotes, error: targetVotesError } = await client
      .from("votes")
      .select("email")
      .eq("speaker_id", targetId);

    if (targetVotesError) {
      console.error("Failed to fetch target votes:", targetVotesError);
      return NextResponse.json(
        { error: "Failed to fetch target votes" },
        { status: 500 }
      );
    }

    const targetVoterEmails = new Set((targetVotes || []).map((v) => v.email));

    // Filter out votes that already exist for the target
    const votesToTransfer = (sourceVotes || []).filter(
      (vote) => !targetVoterEmails.has(vote.email)
    );

    // Transfer votes to target (only new ones)
    if (votesToTransfer.length > 0) {
      const { error: transferError } = await client
        .from("votes")
        .insert(
          votesToTransfer.map((vote) => ({
            speaker_id: targetId,
            email: vote.email,
          }))
        );

      if (transferError) {
        console.error("Failed to transfer votes:", transferError);
        return NextResponse.json(
          { error: "Failed to transfer votes" },
          { status: 500 }
        );
      }
    }

    // Delete all votes from source
    const { error: deleteError } = await client
      .from("votes")
      .delete()
      .eq("speaker_id", sourceId);

    if (deleteError) {
      console.error("Failed to delete source votes:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete source votes" },
        { status: 500 }
      );
    }

    // Mark source as reviewed, rejected, and duplicate
    const { error: updateError } = await client
      .from("suggest")
      .update({
        reviewed: true,
        approved: false,
        duplicate: true,
      })
      .eq("id", sourceId);

    if (updateError) {
      console.error("Failed to update source suggestion:", updateError);
      return NextResponse.json(
        { error: "Failed to update source suggestion" },
        { status: 500 }
      );
    }

    // Return fresh suggestions using the same logic as the initial page load
    const { suggestions } = await getAdminSuggestions();
    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    console.error("Duplicate merge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

