import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { getAdminSuggestions } from "@/app/suggest/data";
import { isValidUUID } from "@/app/lib/validation";
import { db, eq, suggest, votes } from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";
import { sendSuggestionApprovedEmail } from "@/app/lib/email";
import { isValidEmail, isValidUrl } from "@/app/lib/validation";

export async function POST(req: Request) {
  try {
    const auth = await requirePermission("suggestions.manage");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { id, action } = body;

    if (!id || !action || !["approve", "reject", "unapprove"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid suggestion ID format" },
        { status: 400 },
      );
    }

    const existing = await db.query.suggest.findFirst({
      where: eq(suggest.id, id),
      columns: { speaker: true, email: true, approved: true },
    });

    // "unapprove" sends an approved pick back to Pending for re-review;
    // "reject" and "approve" both leave it reviewed.
    await db.update(suggest)
      .set({ reviewed: action !== "unapprove", approved: action === "approve" })
      .where(eq(suggest.id, id));

    await logAuditEvent({
      action:
        action === "approve"
          ? "suggestion.approve"
          : action === "unapprove"
            ? "suggestion.unapprove"
            : "suggestion.reject",
      actor: auth.email!,
      targetEmail: existing?.email ?? undefined,
      metadata: { suggestionId: id, speaker: existing?.speaker },
    });

    // Notify the suggester when their pick first goes live on the leaderboard.
    if (
      action === "approve" &&
      !existing?.approved &&
      existing?.email &&
      existing?.speaker &&
      isValidEmail(existing.email)
    ) {
      try {
        await sendSuggestionApprovedEmail({
          email: existing.email,
          speaker: existing.speaker,
          suggestionId: id,
        });
      } catch (emailError) {
        console.error("Failed to send suggestion approval email:", emailError);
      }
    }

    // Return fresh suggestions using the same logic as the initial page load
    const { suggestions } = await getAdminSuggestions();
    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    console.error("Suggestion action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requirePermission("suggestions.manage");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { id, speaker, duplicate, spoke, eventLink } = body;

    if (!id) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid suggestion ID format" },
        { status: 400 },
      );
    }

    // Handle marking that the speaker came/spoke (acts as a hide on the public
    // site). When marking spoke, the suggestion's unique link redirects to the
    // optional event link (or to /past-speakers when none is set).
    if (typeof spoke === "boolean") {
      const existing = await db.query.suggest.findFirst({
        where: eq(suggest.id, id),
        columns: { speaker: true },
      });

      // Only carry an event link when marking spoke; clear it when unhiding.
      let nextEventLink: string | null = null;
      if (spoke) {
        const trimmed =
          typeof eventLink === "string" ? eventLink.trim() : "";
        if (trimmed) {
          if (!isValidUrl(trimmed)) {
            return NextResponse.json(
              { error: "Event link must be a valid http(s) URL" },
              { status: 400 },
            );
          }
          nextEventLink = trimmed;
        }
      }

      await db.update(suggest)
        .set({ spoke, eventLink: nextEventLink })
        .where(eq(suggest.id, id));

      await logAuditEvent({
        action: "suggestion.mark_spoke",
        actor: auth.email!,
        metadata: {
          suggestionId: id,
          speaker: existing?.speaker,
          spoke,
          eventLink: nextEventLink,
        },
      });

      const { suggestions } = await getAdminSuggestions();
      return NextResponse.json({ success: true, suggestions });
    }

    // Handle marking as duplicate
    if (typeof duplicate === "boolean") {
      const existing = await db.query.suggest.findFirst({
        where: eq(suggest.id, id),
        columns: { speaker: true },
      });

      await db.update(suggest)
        .set({ duplicate })
        .where(eq(suggest.id, id));

      await logAuditEvent({
        action: "suggestion.mark_duplicate",
        actor: auth.email!,
        metadata: { suggestionId: id, speaker: existing?.speaker, duplicate },
      });

      // Return fresh suggestions using the same logic as the initial page load
      const { suggestions } = await getAdminSuggestions();
      return NextResponse.json({ success: true, suggestions });
    }

    // Handle updating speaker name
    if (typeof speaker !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const existing = await db.query.suggest.findFirst({
      where: eq(suggest.id, id),
      columns: { speaker: true },
    });

    await db.update(suggest)
      .set({ speaker: speaker.trim() })
      .where(eq(suggest.id, id));

    await logAuditEvent({
      action: "suggestion.edit",
      actor: auth.email!,
      metadata: { suggestionId: id, oldSpeaker: existing?.speaker, newSpeaker: speaker.trim() },
    });

    // Return fresh suggestions using the same logic as the initial page load
    const { suggestions } = await getAdminSuggestions();
    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    console.error("Suggestion edit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requirePermission("suggestions.manage");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { sourceId, targetId } = body;

    if (
      !sourceId ||
      !targetId ||
      typeof sourceId !== "string" ||
      typeof targetId !== "string"
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Validate UUID formats
    if (!isValidUUID(sourceId) || !isValidUUID(targetId)) {
      return NextResponse.json(
        { error: "Invalid suggestion ID format" },
        { status: 400 },
      );
    }

    if (sourceId === targetId) {
      return NextResponse.json(
        { error: "Cannot merge a suggestion into itself" },
        { status: 400 },
      );
    }

    // Source can be pending, rejected, or approved (deduping two approved picks);
    // target must be approved.
    const source = await db.query.suggest.findFirst({
      where: eq(suggest.id, sourceId),
      columns: { id: true, reviewed: true, approved: true },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source suggestion not found" },
        { status: 400 },
      );
    }

    const target = await db.query.suggest.findFirst({
      where: eq(suggest.id, targetId),
      columns: { id: true, approved: true },
    });

    if (!target || !target.approved) {
      return NextResponse.json(
        { error: "Target suggestion must be approved" },
        { status: 400 },
      );
    }

    // Get all votes from the source suggestion
    const sourceVotes = await db.query.votes.findMany({
      where: eq(votes.speakerId, sourceId),
      columns: { email: true },
    });

    // Get existing votes for the target to avoid duplicates
    const targetVotes = await db.query.votes.findMany({
      where: eq(votes.speakerId, targetId),
      columns: { email: true },
    });

    const targetVoterEmails = new Set(targetVotes.map((v) => v.email));

    // Filter out votes that already exist for the target
    const votesToTransfer = sourceVotes.filter(
      (vote) => vote.email && !targetVoterEmails.has(vote.email),
    );

    // Transfer votes to target (only new ones)
    if (votesToTransfer.length > 0) {
      await db.insert(votes).values(
        votesToTransfer.map((vote) => ({
          speakerId: targetId,
          email: vote.email!,
        })),
      );
    }

    // Delete all votes from source
    await db.delete(votes).where(eq(votes.speakerId, sourceId));

    // Mark source as reviewed, rejected, and duplicate
    await db.update(suggest)
      .set({ reviewed: true, approved: false, duplicate: true })
      .where(eq(suggest.id, sourceId));

    await logAuditEvent({
      action: "suggestion.merge",
      actor: auth.email!,
      metadata: { sourceId, targetId, votesTransferred: votesToTransfer.length },
    });

    // Return fresh suggestions using the same logic as the initial page load
    const { suggestions } = await getAdminSuggestions();
    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    console.error("Duplicate merge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
