import { getSessionUser } from "@/app/lib/auth";
import { db, sql } from "@ssb/db";

export type ViewerEventState = {
  authenticated: boolean;
  userEmail: string | null;
  ticketId: string | null;
  ticketType: string | null;
  ticketName: string | null;
  ticketScanned: boolean;
  isOnWaitlist: boolean;
  waitlistPosition: number | null;
  isNotified: boolean;
  allowAdmittingStandby: boolean;
};

const anonymousViewerEventState: ViewerEventState = {
  authenticated: false,
  userEmail: null,
  ticketId: null,
  ticketType: null,
  ticketName: null,
  ticketScanned: false,
  isOnWaitlist: false,
  waitlistPosition: null,
  isNotified: false,
  allowAdmittingStandby: false,
};

type ViewerEventStateRow = {
  ticket_id: string | null;
  ticket_type: string | null;
  ticket_name: string | null;
  ticket_scanned: boolean | null;
  is_on_waitlist: boolean | null;
  waitlist_position: number | string | null;
  is_notified: boolean | null;
  allow_admitting_standby: boolean | null;
};

function toOptionalNumber(value: number | string | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getAnonymousViewerEventState(): ViewerEventState {
  return anonymousViewerEventState;
}

export async function getViewerEventState(
  eventId: string,
): Promise<ViewerEventState> {
  const user = await getSessionUser();

  if (!user?.email) {
    return getAnonymousViewerEventState();
  }

  const [row] = await db.execute<ViewerEventStateRow>(sql`
    SELECT
      t.id AS ticket_id,
      t.type AS ticket_type,
      t.name AS ticket_name,
      t.scanned AS ticket_scanned,
      w.id IS NOT NULL AS is_on_waitlist,
      w.position AS waitlist_position,
      n.id IS NOT NULL AS is_notified,
      e.allow_admitting_standby AS allow_admitting_standby
    FROM (
      SELECT ${eventId}::uuid AS event_id, ${user.email}::text AS email
    ) viewer
    LEFT JOIN tickets t
      ON t.event_id = viewer.event_id
      AND t.email = viewer.email
    LEFT JOIN waitlist w
      ON w.event_id = viewer.event_id
      AND w.email = viewer.email
    LEFT JOIN notify n
      ON n.speaker_id = viewer.event_id
      AND n.email = viewer.email
    LEFT JOIN events e
      ON e.id = viewer.event_id
    LIMIT 1
  `);

  return {
    authenticated: true,
    userEmail: user.email,
    ticketId: row?.ticket_id ?? null,
    ticketType: row?.ticket_type ?? null,
    ticketName: row?.ticket_name ?? null,
    ticketScanned: row?.ticket_scanned ?? false,
    isOnWaitlist: row?.is_on_waitlist ?? false,
    waitlistPosition: toOptionalNumber(row?.waitlist_position ?? null),
    isNotified: row?.is_notified ?? false,
    allowAdmittingStandby: row?.allow_admitting_standby ?? false,
  };
}
