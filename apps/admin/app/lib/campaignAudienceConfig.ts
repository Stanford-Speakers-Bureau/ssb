export type AudienceType =
  | "event_ticketholders"
  | "event_ticket_type"
  | "event_notify_no_ticket"
  | "event_notify"
  | "event_not_checked_in"
  | "event_feedback_pending"
  | "event_feedback_alias_missed"
  | "event_waitlist"
  | "event_past_attendees"
  | "all_users"
  | "past_attendees"
  | "newsletter";

export type AudienceSegment = {
  type: AudienceType;
  eventIds: string[];
  ticketType?: string;
};

export const AUDIENCE_TYPE_LABELS: Record<AudienceType, string> = {
  event_ticketholders: "All ticket holders",
  event_ticket_type: "Ticket holders by type",
  event_notify_no_ticket: "Notify list (no ticket)",
  event_notify: "Notify list (all)",
  event_not_checked_in: "Not checked in",
  event_feedback_pending: "Checked in, no feedback yet",
  event_feedback_alias_missed: "Missed feedback prompt (email alias)",
  event_waitlist: "On waitlist",
  event_past_attendees: "Checked-in attendees",
  all_users: "All registered users",
  past_attendees: "All past attendees",
  newsletter: "Newsletter subscribers",
};

export const TICKET_TYPES = [
  "STANDARD",
  "VIP",
  "EXTERNAL",
  "STANDBY",
] as const;

export type AudienceOption = {
  value: AudienceType;
  label: string;
  needsEvent: boolean;
  needsTicketType?: boolean;
};

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  {
    value: "event_ticketholders",
    label: AUDIENCE_TYPE_LABELS.event_ticketholders,
    needsEvent: true,
  },
  {
    value: "event_ticket_type",
    label: AUDIENCE_TYPE_LABELS.event_ticket_type,
    needsEvent: true,
    needsTicketType: true,
  },
  {
    value: "event_notify_no_ticket",
    label: AUDIENCE_TYPE_LABELS.event_notify_no_ticket,
    needsEvent: true,
  },
  {
    value: "event_notify",
    label: AUDIENCE_TYPE_LABELS.event_notify,
    needsEvent: true,
  },
  {
    value: "event_not_checked_in",
    label: AUDIENCE_TYPE_LABELS.event_not_checked_in,
    needsEvent: true,
  },
  {
    value: "event_feedback_pending",
    label: AUDIENCE_TYPE_LABELS.event_feedback_pending,
    needsEvent: true,
  },
  {
    value: "event_feedback_alias_missed",
    label: AUDIENCE_TYPE_LABELS.event_feedback_alias_missed,
    needsEvent: true,
  },
  {
    value: "event_waitlist",
    label: AUDIENCE_TYPE_LABELS.event_waitlist,
    needsEvent: true,
  },
  {
    value: "event_past_attendees",
    label: AUDIENCE_TYPE_LABELS.event_past_attendees,
    needsEvent: true,
  },
  {
    value: "all_users",
    label: AUDIENCE_TYPE_LABELS.all_users,
    needsEvent: false,
  },
  {
    value: "past_attendees",
    label: AUDIENCE_TYPE_LABELS.past_attendees,
    needsEvent: false,
  },
  {
    value: "newsletter",
    label: AUDIENCE_TYPE_LABELS.newsletter,
    needsEvent: false,
  },
];

const EVENT_SCOPED_TYPES: AudienceType[] = [
  "event_ticketholders",
  "event_ticket_type",
  "event_notify_no_ticket",
  "event_notify",
  "event_not_checked_in",
  "event_feedback_pending",
  "event_feedback_alias_missed",
  "event_waitlist",
  "event_past_attendees",
];

/**
 * Segments whose recipients are guaranteed (or near-guaranteed) to hold a
 * ticket for the referenced event(s). Used to suggest the right footer type
 * in the campaign editor — these audiences should typically get an
 * "essential" notice, not an unsubscribe link.
 */
const TICKET_HOLDER_TYPES: AudienceType[] = [
  "event_ticketholders",
  "event_ticket_type",
  "event_not_checked_in",
  "event_feedback_pending",
  "event_feedback_alias_missed",
  "event_past_attendees",
  "past_attendees",
];

export function isEventScoped(audienceType: string): boolean {
  return EVENT_SCOPED_TYPES.includes(audienceType as AudienceType);
}

export function isTicketHolderAudience(audienceType: string): boolean {
  return TICKET_HOLDER_TYPES.includes(audienceType as AudienceType);
}

export function needsTicketType(audienceType: string): boolean {
  return audienceType === "event_ticket_type";
}

export function isValidAudienceType(value: string): value is AudienceType {
  return Object.prototype.hasOwnProperty.call(AUDIENCE_TYPE_LABELS, value);
}

export function parseAudienceSegments(input: unknown): AudienceSegment[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || !("type" in entry)) {
      return [];
    }

    const type = (entry as { type: unknown }).type;
    if (typeof type !== "string" || !isValidAudienceType(type)) {
      return [];
    }

    const rawEventIds = "eventIds" in entry
      ? (entry as { eventIds?: unknown }).eventIds
      : [];
    if (!Array.isArray(rawEventIds)) {
      return [];
    }

    const eventIds = rawEventIds
      .filter((eventId): eventId is string => typeof eventId === "string")
      .map((eventId) => eventId.trim())
      .filter(Boolean);

    if (isEventScoped(type) && eventIds.length === 0) {
      return [];
    }

    const ticketType = "ticketType" in entry
      ? (entry as { ticketType?: unknown }).ticketType
      : undefined;

    if (needsTicketType(type)) {
      if (
        typeof ticketType !== "string" ||
        !(TICKET_TYPES as readonly string[]).includes(ticketType)
      ) {
        return [];
      }

      return [{ type, eventIds, ticketType }];
    }

    return [{ type, eventIds }];
  });
}
