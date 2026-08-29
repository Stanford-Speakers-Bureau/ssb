import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { getAdminEventQuestions } from "@/app/event-questions/data";
import { db, eq, events } from "@ssb/db";
import { isValidUUID } from "@/app/lib/validation";
import { logAuditEvent } from "@/app/lib/audit";

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { eventId, enabled } = body as {
      eventId?: string;
      enabled?: boolean;
    };

    if (!eventId || typeof eventId !== "string" || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request: eventId and enabled (boolean) required" },
        { status: 400 },
      );
    }
    if (!isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Invalid event ID format" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("questions.manage", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const existing = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { id: true, name: true, questionsEnabled: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await db
      .update(events)
      .set({ questionsEnabled: enabled })
      .where(eq(events.id, eventId));

    await logAuditEvent({
      action: enabled
        ? "event_question.event_enabled"
        : "event_question.event_disabled",
      actor: auth.email!,
      eventId,
      eventName: existing.name ?? undefined,
      metadata: { previous: existing.questionsEnabled, next: enabled },
    });

    const { questions } = await getAdminEventQuestions();
    return NextResponse.json({ success: true, enabled, questions });
  } catch (error) {
    console.error("Toggle event questions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
