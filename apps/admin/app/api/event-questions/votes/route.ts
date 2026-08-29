import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { getAdminEventQuestions } from "@/app/event-questions/data";
import { db, eq, eventQuestions } from "@ssb/db";
import { isValidUUID } from "@/app/lib/validation";
import { logAuditEvent } from "@/app/lib/audit";

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, votes } = body as { id?: string; votes?: number };

    if (
      !id ||
      typeof id !== "string" ||
      typeof votes !== "number" ||
      votes < 0 ||
      !Number.isInteger(votes)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid request: id and votes (non-negative integer) are required",
        },
        { status: 400 },
      );
    }
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid question ID format" },
        { status: 400 },
      );
    }

    const existing = await db.query.eventQuestions.findFirst({
      where: eq(eventQuestions.id, id),
      columns: { id: true, votes: true, eventId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    const auth = await requirePermission("questions.manage", existing.eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    await db
      .update(eventQuestions)
      .set({ votes })
      .where(eq(eventQuestions.id, id));

    await logAuditEvent({
      action: "event_question.edit_votes",
      actor: auth.email!,
      metadata: { questionId: id, oldVotes: existing.votes, newVotes: votes },
    });

    const { questions } = await getAdminEventQuestions();
    return NextResponse.json({ success: true, questions });
  } catch (error) {
    console.error("Edit event-question votes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
