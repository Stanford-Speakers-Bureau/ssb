import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { db, eq, and, suggest, votes } from "@ssb/db";
import { voteRatelimit, checkRateLimit } from "@/app/lib/ratelimit";
import { isValidUUID } from "@/app/lib/validation";

export const VOTE_MESSAGES = {
  SUCCESS: "Vote recorded!",
  REMOVED: "Vote removed.",
  ALREADY_VOTED: "You've already voted for this speaker.",
  NOT_VOTED: "You haven't voted for this speaker.",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in with Stanford.",
  ERROR_MISSING_SPEAKER_ID: "Missing required field: speaker_id",
  ERROR_SPEAKER_NOT_FOUND: "Speaker suggestion not found.",
} as const;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    const rateLimitResponse = await checkRateLimit(
      voteRatelimit,
      `vote:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { speaker_id } = body as { speaker_id?: string };

    if (!speaker_id || typeof speaker_id !== "string") {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_MISSING_SPEAKER_ID },
        { status: 400 },
      );
    }

    if (!isValidUUID(speaker_id)) {
      return NextResponse.json(
        { error: "Invalid speaker ID format" },
        { status: 400 },
      );
    }

    // Check if the speaker suggestion exists and is approved
    const suggestion = await db.query.suggest.findFirst({
      where: and(eq(suggest.id, speaker_id), eq(suggest.approved, true)),
      columns: { id: true, votes: true },
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_SPEAKER_NOT_FOUND },
        { status: 404 },
      );
    }

    // Check if user has already voted
    const existingVote = await db.query.votes.findFirst({
      where: and(eq(votes.speakerId, speaker_id), eq(votes.email, user.email)),
      columns: { id: true },
    });

    if (existingVote) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ALREADY_VOTED, alreadyVoted: true },
        { status: 400 },
      );
    }

    // Insert the vote
    await db.insert(votes).values({ speakerId: speaker_id, email: user.email });

    return NextResponse.json(
      { success: true },
      { status: 200 },
    );
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json(
      { error: VOTE_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_NOT_AUTHENTICATED },
        { status: 401 },
      );
    }

    const rateLimitResponse = await checkRateLimit(
      voteRatelimit,
      `vote:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { speaker_id } = body as { speaker_id?: string };

    if (!speaker_id || typeof speaker_id !== "string") {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_MISSING_SPEAKER_ID },
        { status: 400 },
      );
    }

    if (!isValidUUID(speaker_id)) {
      return NextResponse.json(
        { error: "Invalid speaker ID format" },
        { status: 400 },
      );
    }

    // Check if the speaker suggestion exists
    const suggestion = await db.query.suggest.findFirst({
      where: eq(suggest.id, speaker_id),
      columns: { id: true, votes: true },
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.ERROR_SPEAKER_NOT_FOUND },
        { status: 404 },
      );
    }

    // Check if user has voted for this speaker
    const existingVote = await db.query.votes.findFirst({
      where: and(eq(votes.speakerId, speaker_id), eq(votes.email, user.email)),
      columns: { id: true },
    });

    if (!existingVote) {
      return NextResponse.json(
        { error: VOTE_MESSAGES.NOT_VOTED },
        { status: 400 },
      );
    }

    // Delete the vote
    await db.delete(votes).where(eq(votes.id, existingVote.id));

    return NextResponse.json(
      { success: true },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unvote error:", error);
    return NextResponse.json(
      { error: VOTE_MESSAGES.ERROR_GENERIC },
      { status: 500 },
    );
  }
}
