import { jwtVerify } from "jose";
import { normalizeEmail } from "@/app/lib/validation";

const DEV_SECRET = "dev-secret-change-me-in-production-1234";
const TOKEN_PURPOSE = "event_feedback";

export type EventFeedbackTokenClaims = {
  email: string;
  ticketId: string;
  eventId: string;
};

function getFeedbackLinkSecret(): Uint8Array {
  const secret =
    process.env.FEEDBACK_LINK_SECRET ||
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? null : DEV_SECRET);

  if (!secret) {
    throw new Error(
      "FEEDBACK_LINK_SECRET or SESSION_SECRET must be set in production.",
    );
  }

  return new TextEncoder().encode(secret);
}

export async function verifyEventFeedbackToken(
  token: string,
): Promise<EventFeedbackTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getFeedbackLinkSecret(), {
      algorithms: ["HS256"],
    });

    if (payload.purpose !== TOKEN_PURPOSE) {
      return null;
    }

    const email = typeof payload.email === "string" ? payload.email : null;
    const ticketId =
      typeof payload.ticketId === "string" ? payload.ticketId : null;
    const eventId =
      typeof payload.eventId === "string" ? payload.eventId : null;

    if (!email || !ticketId || !eventId) {
      return null;
    }

    return {
      email: normalizeEmail(email),
      ticketId,
      eventId,
    };
  } catch {
    return null;
  }
}
