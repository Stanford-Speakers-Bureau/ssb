import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { getAdminEventQuestions } from "@/app/event-questions/data";
import { isValidUUID, isValidEmail } from "@/app/lib/validation";
import {
  db,
  eq,
  eventQuestions,
  eventQuestionVotes,
  events,
} from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";
import { sendEventQuestionApprovedEmail } from "@/app/lib/email";

const MIN_LEN = 4;
const MAX_LEN = 280;

class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

async function mergeDuplicateQuestion(sourceId: string, targetId: string) {
  if (sourceId === targetId) {
    throw new RequestError("Cannot merge a question into itself");
  }

  return db.transaction(async (tx) => {
    const source = await tx.query.eventQuestions.findFirst({
      where: eq(eventQuestions.id, sourceId),
      columns: {
        id: true,
        approved: true,
        duplicate: true,
        eventId: true,
        question: true,
      },
    });
    if (!source) throw new RequestError("Source question not found", 404);
    if (source.duplicate) {
      throw new RequestError("Source is already marked duplicate");
    }

    const target = await tx.query.eventQuestions.findFirst({
      where: eq(eventQuestions.id, targetId),
      columns: {
        id: true,
        approved: true,
        hidden: true,
        duplicate: true,
        eventId: true,
        question: true,
      },
    });
    if (!target) throw new RequestError("Target question not found", 404);
    if (!target.approved || target.hidden || target.duplicate) {
      throw new RequestError("Target must be a visible approved question");
    }
    if (source.eventId !== target.eventId) {
      throw new RequestError("Cannot merge questions across different events");
    }

    const sourceVotes = await tx.query.eventQuestionVotes.findMany({
      where: eq(eventQuestionVotes.questionId, sourceId),
      columns: { email: true },
    });
    const targetVotes = await tx.query.eventQuestionVotes.findMany({
      where: eq(eventQuestionVotes.questionId, targetId),
      columns: { email: true },
    });
    const targetVoterEmails = new Set(targetVotes.map((v) => v.email));
    const toTransfer = sourceVotes.filter(
      (v) => v.email && !targetVoterEmails.has(v.email),
    );

    if (toTransfer.length > 0) {
      await tx.insert(eventQuestionVotes).values(
        toTransfer.map((v) => ({
          questionId: targetId,
          email: v.email!,
        })),
      );
    }

    await tx
      .delete(eventQuestionVotes)
      .where(eq(eventQuestionVotes.questionId, sourceId));

    await tx
      .update(eventQuestions)
      .set({ reviewed: true, approved: false, duplicate: true, hidden: true })
      .where(eq(eventQuestions.id, sourceId));

    return {
      eventId: source.eventId,
      sourceQuestion: source.question,
      targetQuestion: target.question,
      votesTransferred: toTransfer.length,
    };
  });
}

function requestErrorResponse(error: unknown) {
  if (error instanceof RequestError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, action } = body as { id?: string; action?: string };

    if (!id || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid question ID format" },
        { status: 400 },
      );
    }

    const existing = await db.query.eventQuestions.findFirst({
      where: eq(eventQuestions.id, id),
      columns: {
        id: true,
        question: true,
        email: true,
        approved: true,
        eventId: true,
      },
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
      .set({ reviewed: true, approved: action === "approve" })
      .where(eq(eventQuestions.id, id));

    await logAuditEvent({
      action:
        action === "approve"
          ? "event_question.approve"
          : "event_question.reject",
      actor: auth.email!,
      eventId: existing.eventId,
      targetEmail: existing.email ?? undefined,
      metadata: { questionId: id, question: existing.question },
    });

    if (
      action === "approve" &&
      !existing.approved &&
      existing.email &&
      existing.question &&
      isValidEmail(existing.email)
    ) {
      try {
        const event = await db.query.events.findFirst({
          where: eq(events.id, existing.eventId),
          columns: { name: true, route: true, id: true },
        });
        if (event) {
          await sendEventQuestionApprovedEmail({
            email: existing.email,
            question: existing.question,
            eventName: event.name ?? "the event",
            eventRoute: event.route ?? event.id,
          });
        }
      } catch (emailError) {
        console.error(
          "Failed to send event question approval email:",
          emailError,
        );
      }
    }

    const { questions } = await getAdminEventQuestions();
    return NextResponse.json({ success: true, questions });
  } catch (error) {
    console.error("Event question action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, question, duplicate, hidden, targetId } = body as {
      id?: string;
      question?: string;
      duplicate?: boolean;
      hidden?: boolean;
      targetId?: string;
    };

    if (!id) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid question ID format" },
        { status: 400 },
      );
    }

    const existing = await db.query.eventQuestions.findFirst({
      where: eq(eventQuestions.id, id),
      columns: { question: true, eventId: true },
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

    if (typeof hidden === "boolean") {
      await db
        .update(eventQuestions)
        .set({ hidden })
        .where(eq(eventQuestions.id, id));
      await logAuditEvent({
        action: hidden ? "event_question.hide" : "event_question.unhide",
        actor: auth.email!,
        eventId: existing.eventId,
        metadata: { questionId: id, question: existing.question, hidden },
      });
      const { questions } = await getAdminEventQuestions();
      return NextResponse.json({ success: true, questions });
    }

    if (typeof duplicate === "boolean") {
      if (duplicate) {
        if (!targetId || typeof targetId !== "string") {
          return NextResponse.json(
            { error: "Target question is required to mark duplicate" },
            { status: 400 },
          );
        }
        if (!isValidUUID(targetId)) {
          return NextResponse.json(
            { error: "Invalid target question ID format" },
            { status: 400 },
          );
        }
        const result = await mergeDuplicateQuestion(id, targetId);
        await logAuditEvent({
          action: "event_question.merge",
          actor: auth.email!,
          eventId: result.eventId,
          metadata: {
            sourceId: id,
            targetId,
            eventId: result.eventId,
            sourceQuestion: result.sourceQuestion,
            targetQuestion: result.targetQuestion,
            votesTransferred: result.votesTransferred,
          },
        });
        const { questions } = await getAdminEventQuestions();
        return NextResponse.json({ success: true, questions });
      }

      await db
        .update(eventQuestions)
        .set({ duplicate: false })
        .where(eq(eventQuestions.id, id));
      await logAuditEvent({
        action: "event_question.mark_duplicate",
        actor: auth.email!,
        eventId: existing.eventId,
        metadata: {
          questionId: id,
          question: existing.question,
          duplicate: false,
        },
      });
      const { questions } = await getAdminEventQuestions();
      return NextResponse.json({ success: true, questions });
    }

    if (typeof question !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const trimmed = question.trim();
    if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) {
      return NextResponse.json(
        { error: "Question must be 4–280 characters" },
        { status: 400 },
      );
    }

    await db
      .update(eventQuestions)
      .set({ question: trimmed })
      .where(eq(eventQuestions.id, id));
    await logAuditEvent({
      action: "event_question.edit",
      actor: auth.email!,
      eventId: existing.eventId,
      metadata: {
        questionId: id,
        oldQuestion: existing.question,
        newQuestion: trimmed,
      },
    });

    const { questions } = await getAdminEventQuestions();
    return NextResponse.json({ success: true, questions });
  } catch (error) {
    const response = requestErrorResponse(error);
    if (response) return response;
    console.error("Event question edit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { sourceId, targetId } = body as {
      sourceId?: string;
      targetId?: string;
    };
    if (
      !sourceId ||
      !targetId ||
      typeof sourceId !== "string" ||
      typeof targetId !== "string"
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (!isValidUUID(sourceId) || !isValidUUID(targetId)) {
      return NextResponse.json(
        { error: "Invalid question ID format" },
        { status: 400 },
      );
    }

    const source = await db.query.eventQuestions.findFirst({
      where: eq(eventQuestions.id, sourceId),
      columns: { eventId: true },
    });
    if (!source) {
      return NextResponse.json(
        { error: "Source question not found" },
        { status: 404 },
      );
    }

    const auth = await requirePermission("questions.manage", source.eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const result = await mergeDuplicateQuestion(sourceId, targetId);

    await logAuditEvent({
      action: "event_question.merge",
      actor: auth.email!,
      eventId: result.eventId,
      metadata: {
        sourceId,
        targetId,
        eventId: result.eventId,
        sourceQuestion: result.sourceQuestion,
        targetQuestion: result.targetQuestion,
        votesTransferred: result.votesTransferred,
      },
    });

    const { questions } = await getAdminEventQuestions();
    return NextResponse.json({ success: true, questions });
  } catch (error) {
    const response = requestErrorResponse(error);
    if (response) return response;
    console.error("Event question merge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
