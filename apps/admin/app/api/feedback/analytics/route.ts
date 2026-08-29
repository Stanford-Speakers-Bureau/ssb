import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { isValidUUID } from "@/app/lib/validation";
import { db, eq, events, eventFeedback, tickets } from "@ssb/db";

type FeedbackRow = {
  ticketId: string;
  name: string | null;
  email: string;
  score: number;
  comment: string | null;
  submittedAt: string;
  updatedAt: string;
  submittedVia: string;
};

type EligibleTicketRow = {
  ticketId: string;
  name: string | null;
  email: string;
  scanTime: string | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Valid eventId is required" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("audience.view", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const [event, scannedTickets, feedbackRows] = await Promise.all([
      db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          id: true,
          name: true,
          startTimeDate: true,
          endTimeDate: true,
        },
      }),
      db.query.tickets.findMany({
        where: eq(tickets.eventId, eventId),
        columns: {
          id: true,
          name: true,
          email: true,
          scanned: true,
          scanTime: true,
        },
      }),
      db.query.eventFeedback.findMany({
        where: eq(eventFeedback.eventId, eventId),
        columns: {
          ticketId: true,
          score: true,
          comment: true,
          createdAt: true,
          updatedAt: true,
          submittedVia: true,
        },
      }),
    ]);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const scannedOnly = scannedTickets.filter((t) => t.scanned);
    const ticketById = new Map(scannedOnly.map((t) => [t.id, t]));

    const feedback: FeedbackRow[] = [];
    const respondedTicketIds = new Set<string>();

    const scoreDistribution: number[] = Array(10).fill(0);
    let scoreTotal = 0;
    let promoters = 0;
    let passives = 0;
    let detractors = 0;

    for (const row of feedbackRows) {
      const ticket = ticketById.get(row.ticketId);
      if (!ticket) continue;

      respondedTicketIds.add(row.ticketId);
      feedback.push({
        ticketId: row.ticketId,
        name: ticket.name ?? null,
        email: ticket.email,
        score: row.score,
        comment: row.comment ?? null,
        submittedAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        submittedVia: row.submittedVia,
      });

      if (row.score >= 1 && row.score <= 10) {
        scoreDistribution[row.score - 1] += 1;
        scoreTotal += row.score;
      }

      if (row.score >= 9) {
        promoters += 1;
      } else if (row.score >= 7) {
        passives += 1;
      } else {
        detractors += 1;
      }
    }

    feedback.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const eligibleMissing: EligibleTicketRow[] = scannedOnly
      .filter((t) => !respondedTicketIds.has(t.id))
      .map((t) => ({
        ticketId: t.id,
        name: t.name ?? null,
        email: t.email,
        scanTime: t.scanTime?.toISOString() ?? null,
      }))
      .sort((a, b) => {
        const aTime = a.scanTime ?? "";
        const bTime = b.scanTime ?? "";
        return bTime.localeCompare(aTime);
      });

    const totalScanned = scannedOnly.length;
    const totalResponses = feedback.length;
    const responseRate =
      totalScanned > 0 ? (totalResponses / totalScanned) * 100 : 0;
    const averageScore =
      totalResponses > 0 ? scoreTotal / totalResponses : 0;
    const npsScore =
      totalResponses > 0
        ? ((promoters - detractors) / totalResponses) * 100
        : 0;

    return NextResponse.json({
      eventId: event.id,
      eventName: event.name,
      eventStartTime: event.startTimeDate?.toISOString() ?? null,
      eventEndTime: event.endTimeDate?.toISOString() ?? null,
      totalScanned,
      totalResponses,
      responseRate,
      averageScore,
      npsScore,
      promoters,
      passives,
      detractors,
      scoreDistribution,
      feedback,
      eligibleMissing,
    });
  } catch (error) {
    console.error("Feedback analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
