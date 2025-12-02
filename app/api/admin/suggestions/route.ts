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

    let query = auth.adminClient!.from("suggest").select("*").order("created_at", { ascending: false });

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

    const { data: suggestions, error } = await query;

    if (error) {
      console.error("Suggestions fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
    }

    return NextResponse.json({ suggestions: suggestions || [] });
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

