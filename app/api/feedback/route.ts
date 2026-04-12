import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { verifyEventFeedbackToken } from "@/app/lib/feedback-links";
import {
  isValidUUID,
  normalizeEmail,
  sanitizeString,
} from "@/app/lib/validation";
import { and, db, eq, eventFeedback, sql, tickets } from "@ssb/db";

const MAX_COMMENT_LENGTH = 1_500;
const SCORE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

type FeedbackResolution =
  | {
      eligible: true;
      via: "session" | "signed_link";
      ticket: {
        id: string;
        email: string;
        name: string | null;
      };
      existingFeedback: {
        score: number;
        comment: string | null;
        submittedAt: string;
        updatedAt: string;
      } | null;
    }
  | {
      eligible: false;
      reason:
        | "invalid_link"
        | "not_signed_in"
        | "no_ticket"
        | "not_checked_in";
      message?: string;
    };

function parseScore(input: unknown): number | null {
  if (typeof input === "number" && Number.isInteger(input)) {
    return input >= 1 && input <= 10 ? input : null;
  }

  if (typeof input === "string" && /^\d+$/.test(input.trim())) {
    const parsed = Number.parseInt(input.trim(), 10);
    return parsed >= 1 && parsed <= 10 ? parsed : null;
  }

  return null;
}

function normalizedTicketEmailEquals(email: string) {
  return sql<boolean>`lower(trim(${tickets.email})) = ${normalizeEmail(email)}`;
}

async function resolveFeedbackRequest(input: {
  eventId: string;
  feedbackToken?: string | null;
}): Promise<FeedbackResolution> {
  const trimmedToken = input.feedbackToken?.trim() || null;

  if (trimmedToken) {
    const claims = await verifyEventFeedbackToken(trimmedToken);
    if (!claims || claims.eventId !== input.eventId) {
      return {
        eligible: false,
        reason: "invalid_link",
        message: "This feedback link is invalid or has expired.",
      };
    }

    const ticket = await db.query.tickets.findFirst({
      where: and(
        eq(tickets.id, claims.ticketId),
        eq(tickets.eventId, input.eventId),
        normalizedTicketEmailEquals(claims.email),
      ),
      columns: {
        id: true,
        email: true,
        name: true,
        scanned: true,
      },
    });

    if (!ticket) {
      return {
        eligible: false,
        reason: "invalid_link",
        message: "This feedback link no longer matches an eligible ticket.",
      };
    }

    if (!ticket.scanned) {
      return {
        eligible: false,
        reason: "not_checked_in",
        message: "Feedback opens after your ticket has been checked in.",
      };
    }

    const feedback = await db.query.eventFeedback.findFirst({
      where: eq(eventFeedback.ticketId, ticket.id),
      columns: {
        score: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      eligible: true,
      via: "signed_link",
      ticket: {
        id: ticket.id,
        email: ticket.email,
        name: ticket.name ?? null,
      },
      existingFeedback: feedback
        ? {
            score: feedback.score,
            comment: feedback.comment ?? null,
            submittedAt: feedback.createdAt.toISOString(),
            updatedAt: feedback.updatedAt.toISOString(),
          }
        : null,
    };
  }

  const sessionUser = await getSessionUser();
  const sessionEmail = sessionUser?.email
    ? normalizeEmail(sessionUser.email)
    : null;

  if (!sessionEmail) {
    return {
      eligible: false,
      reason: "not_signed_in",
    };
  }

  const ticket = await db.query.tickets.findFirst({
    where: and(
      eq(tickets.eventId, input.eventId),
      normalizedTicketEmailEquals(sessionEmail),
    ),
    columns: {
      id: true,
      email: true,
      name: true,
      scanned: true,
    },
  });

  if (!ticket) {
    return {
      eligible: false,
      reason: "no_ticket",
    };
  }

  if (!ticket.scanned) {
    return {
      eligible: false,
      reason: "not_checked_in",
    };
  }

  const feedback = await db.query.eventFeedback.findFirst({
    where: eq(eventFeedback.ticketId, ticket.id),
    columns: {
      score: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    eligible: true,
    via: "session",
    ticket: {
      id: ticket.id,
      email: ticket.email,
      name: ticket.name ?? null,
    },
    existingFeedback: feedback
      ? {
          score: feedback.score,
          comment: feedback.comment ?? null,
          submittedAt: feedback.createdAt.toISOString(),
          updatedAt: feedback.updatedAt.toISOString(),
        }
      : null,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || searchParams.get("event_id");
    const feedbackToken =
      searchParams.get("feedback_token") || searchParams.get("feedbackToken");

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Valid eventId is required" },
        { status: 400 },
      );
    }

    const resolution = await resolveFeedbackRequest({
      eventId,
      feedbackToken,
    });

    if (!resolution.eligible) {
      return NextResponse.json(resolution, { status: 200 });
    }

    return NextResponse.json(
      {
        eligible: true,
        via: resolution.via,
        attendeeName: resolution.ticket.name,
        feedback: resolution.existingFeedback,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Feedback status error:", error);
    return NextResponse.json(
      { error: "Failed to load feedback status" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    let body: {
      eventId?: string;
      score?: number | string;
      comment?: string | null;
      feedbackToken?: string | null;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.eventId || !isValidUUID(body.eventId)) {
      return NextResponse.json(
        { error: "Valid eventId is required" },
        { status: 400 },
      );
    }

    const score = parseScore(body.score);
    if (score == null) {
      return NextResponse.json(
        { error: "score must be an integer from 1 to 10" },
        { status: 400 },
      );
    }

    const commentProvided = "comment" in body;
    let comment: string | null = null;
    if (commentProvided) {
      if (body.comment != null && typeof body.comment !== "string") {
        return NextResponse.json(
          { error: "comment must be a string or null" },
          { status: 400 },
        );
      }

      const rawComment = typeof body.comment === "string" ? body.comment : null;
      if (rawComment != null && rawComment.length > MAX_COMMENT_LENGTH) {
        return NextResponse.json(
          { error: `comment must be ${MAX_COMMENT_LENGTH} characters or fewer` },
          { status: 400 },
        );
      }

      comment = sanitizeString(rawComment, MAX_COMMENT_LENGTH);
    }

    const resolution = await resolveFeedbackRequest({
      eventId: body.eventId,
      feedbackToken:
        typeof body.feedbackToken === "string" ? body.feedbackToken : null,
    });

    if (!resolution.eligible) {
      return NextResponse.json(
        {
          error:
            resolution.message
            || "Only checked-in ticket holders can submit feedback.",
        },
        { status: 403 },
      );
    }

    const now = new Date();
    const updateSet: {
      submittedVia: "session" | "signed_link";
      updatedAt: Date;
      comment?: string | null;
      score?: number;
    } = {
      submittedVia: resolution.via,
      updatedAt: now,
    };
    if (commentProvided) {
      updateSet.comment = comment;
    }

    const existing = resolution.existingFeedback;
    if (existing) {
      const submittedAtMs = new Date(existing.submittedAt).getTime();
      if (now.getTime() - submittedAtMs < SCORE_EDIT_WINDOW_MS) {
        updateSet.score = score;
      }
    }

    const [savedFeedback] = await db.insert(eventFeedback)
      .values({
        eventId: body.eventId,
        ticketId: resolution.ticket.id,
        email: normalizeEmail(resolution.ticket.email),
        score,
        comment,
        submittedVia: resolution.via,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: eventFeedback.ticketId,
        set: updateSet,
      })
      .returning({
        score: eventFeedback.score,
        comment: eventFeedback.comment,
        submittedAt: eventFeedback.createdAt,
        updatedAt: eventFeedback.updatedAt,
      });

    return NextResponse.json(
      {
        success: true,
        feedback: {
          score: savedFeedback.score,
          comment: savedFeedback.comment ?? null,
          submittedAt: savedFeedback.submittedAt.toISOString(),
          updatedAt: savedFeedback.updatedAt.toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Feedback submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 },
    );
  }
}
