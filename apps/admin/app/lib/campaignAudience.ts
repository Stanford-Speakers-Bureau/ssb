import {
  and,
  db,
  eq,
  eventFeedback,
  isNull,
  mailingList,
  notify,
  sql,
  tickets,
  waitlist,
} from "@ssb/db";
import { normalizeEmail } from "@/app/lib/validation";
import {
  isEventScoped,
  isValidAudienceType,
  needsTicketType,
  parseAudienceSegments,
  TICKET_TYPES,
  type AudienceSegment,
  type AudienceType,
} from "@/app/lib/campaignAudienceConfig";

export {
  AUDIENCE_OPTIONS,
  AUDIENCE_TYPE_LABELS,
  isEventScoped,
  isTicketHolderAudience,
  isValidAudienceType,
  needsTicketType,
  parseAudienceSegments,
  TICKET_TYPES,
  type AudienceOption,
  type AudienceSegment,
  type AudienceType,
} from "@/app/lib/campaignAudienceConfig";

export function parseAudiences(json: string): AudienceSegment[] {
  try {
    const arr = JSON.parse(json);
    return parseAudienceSegments(arr);
  } catch {
    return [];
  }
}

export function validateSegments(segments: unknown): segments is AudienceSegment[] {
  if (!Array.isArray(segments) || segments.length === 0) return false;
  return segments.every(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      "type" in s &&
      isValidAudienceType(s.type) &&
      "eventIds" in s &&
      Array.isArray(s.eventIds) &&
      s.eventIds.every(
        (eventId: unknown) =>
          typeof eventId === "string" && eventId.trim().length > 0,
      ) &&
      (!isEventScoped(s.type) || s.eventIds.length > 0) &&
      (!needsTicketType(s.type) ||
        (typeof s.ticketType === "string" &&
          (TICKET_TYPES as readonly string[]).includes(s.ticketType))),
  );
}

export async function resolveSegments(
  segments: AudienceSegment[],
): Promise<string[]> {
  const emailsBySegment = await Promise.all(
    segments.map(async (seg) => {
      if (isEventScoped(seg.type)) {
        const emailsByEvent = await Promise.all(
          seg.eventIds.map((eventId) =>
            resolveAudience(seg.type, eventId, seg.ticketType)
          ),
        );
        return emailsByEvent.flat();
      }

      return resolveAudience(seg.type, null);
    }),
  );

  return dedupe(emailsBySegment.flat());
}

async function resolveAudience(
  audienceType: AudienceType,
  eventId: string | null,
  ticketType?: string,
): Promise<string[]> {
  switch (audienceType) {
    case "event_ticketholders": {
      if (!eventId) return [];
      const rows = await db.query.tickets.findMany({
        where: eq(tickets.eventId, eventId),
        columns: { email: true },
      });
      return rows.map((r) => r.email);
    }

    case "event_ticket_type": {
      if (!eventId || !ticketType) return [];
      const rows = await db.query.tickets.findMany({
        where: (t, { and: a, eq: e }) => a(e(t.eventId, eventId), e(t.type, ticketType)),
        columns: { email: true },
      });
      return rows.map((r) => r.email);
    }

    case "event_notify_no_ticket": {
      if (!eventId) return [];
      const [notifyRows, ticketRows] = await Promise.all([
        db.query.notify.findMany({
          where: eq(notify.speakerId, eventId),
          columns: { email: true },
        }),
        db.query.tickets.findMany({
          where: eq(tickets.eventId, eventId),
          columns: { email: true },
        }),
      ]);
      const ticketEmails = new Set(ticketRows.map((r) => r.email.toLowerCase()));
      return notifyRows
        .map((r) => r.email)
        .filter((e) => !ticketEmails.has(e.toLowerCase()));
    }

    case "event_notify": {
      if (!eventId) return [];
      const rows = await db.query.notify.findMany({
        where: eq(notify.speakerId, eventId),
        columns: { email: true },
      });
      return rows.map((r) => r.email);
    }

    case "event_not_checked_in": {
      if (!eventId) return [];
      const rows = await db.query.tickets.findMany({
        where: (t, { and: a, eq: e }) => a(e(t.eventId, eventId), e(t.scanned, false)),
        columns: { email: true },
      });
      return rows.map((r) => r.email);
    }

    case "event_feedback_pending": {
      if (!eventId) return [];
      const rows = await db
        .select({ email: tickets.email })
        .from(tickets)
        .leftJoin(eventFeedback, eq(eventFeedback.ticketId, tickets.id))
        .where(
          and(
            eq(tickets.eventId, eventId),
            eq(tickets.scanned, true),
            isNull(eventFeedback.id),
          ),
        );
      return rows.map((row) => row.email);
    }

    // Recipients silently dropped from the feedback prompt by the gmail
    // dot/+alias canonicalization bug: scanned attendees whose ticket email
    // canonicalizes to something other than its raw lowercased form (i.e.
    // gmail dots or a +suffix), and who still have no feedback on record.
    // Stanford addresses never match because canonicalize_email leaves their
    // dots intact. Use this to send the one-time correction email.
    case "event_feedback_alias_missed": {
      if (!eventId) return [];
      const rows = await db
        .select({ email: tickets.email })
        .from(tickets)
        .leftJoin(eventFeedback, eq(eventFeedback.ticketId, tickets.id))
        .where(
          and(
            eq(tickets.eventId, eventId),
            eq(tickets.scanned, true),
            isNull(eventFeedback.id),
            sql`public.canonicalize_email(${tickets.email}) <> lower(trim(${tickets.email}))`,
          ),
        );
      return rows.map((row) => row.email);
    }

    case "event_waitlist": {
      if (!eventId) return [];
      const rows = await db.query.waitlist.findMany({
        where: eq(waitlist.eventId, eventId),
        columns: { email: true },
      });
      return rows.map((r) => r.email);
    }

    case "event_past_attendees": {
      if (!eventId) return [];
      const rows = await db.query.tickets.findMany({
        where: (t, { and: a, eq: e }) => a(e(t.eventId, eventId), e(t.scanned, true)),
        columns: { email: true },
      });
      return rows.map((r) => r.email);
    }

    case "all_users": {
      const rows = await db.query.userProfiles.findMany({
        columns: { email: true },
      });
      return rows.map((r) => r.email);
    }

    case "past_attendees": {
      const rows = await db.query.tickets.findMany({
        where: eq(tickets.scanned, true),
        columns: { email: true },
      });
      return rows.map((r) => r.email);
    }

    case "newsletter": {
      // Mailing list members who haven't opted out of either announce
      // (broad "no promo") or newsletter (narrow "no newsletters").
      const rows = await db
        .select({ email: mailingList.email })
        .from(mailingList)
        .where(
          sql`NOT EXISTS (
            SELECT 1 FROM email_unsubscribes u
            WHERE u.scope IN ('announce', 'newsletter')
              AND u.event_id IS NULL
              AND u.email = ${mailingList.email}
          )`,
        );
      return rows.map((r) => r.email);
    }

    default:
      return [];
  }
}

function dedupe(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const email of emails) {
    const normalized = normalizeEmail(email);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
