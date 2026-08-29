import { NextResponse } from "next/server";
import { getHighestAffiliation } from "@/app/lib/affiliation";
import { requirePermission } from "@/app/lib/permissions";
import { getSupabaseClient } from "@/app/lib/supabase";
import { isValidUUID } from "@/app/lib/validation";
import { db, eq, events } from "@ssb/db";

type Affiliation =
  | "student"
  | "faculty"
  | "affiliate"
  | "staff"
  | "member"
  | "missing";

type LegacyAuthUser = {
  email?: string;
  created_at?: string;
  updated_at?: string;
  last_sign_in_at?: string;
  user_metadata?: Record<string, unknown>;
};

type AudienceUserAccumulator = {
  email: string;
  displayName: string | null;
  affiliation: Affiliation;
  lastLoginAt: string | null;
  notifyEventIds: Set<string>;
  waitlistEventIds: Set<string>;
  ticketedEventIds: Set<string>;
  attendedEventIds: Set<string>;
};

const AFFILIATION_PRIORITY: Affiliation[] = [
  "student",
  "faculty",
  "affiliate",
  "staff",
  "member",
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getLaterIsoDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function getLegacyDisplayName(user: LegacyAuthUser): string | null {
  const metadata = user.user_metadata ?? {};

  const direct =
    getStringValue(metadata.display_name) ||
    getStringValue(metadata.full_name) ||
    getStringValue(metadata.name);

  if (direct) return direct;

  const firstName = getStringValue(metadata.first_name);
  const lastName = getStringValue(metadata.last_name);

  if (firstName && lastName) return `${firstName} ${lastName}`;
  return firstName || lastName || null;
}

function createUserAccumulator(email: string): AudienceUserAccumulator {
  return {
    email,
    displayName: null,
    affiliation: "missing",
    lastLoginAt: null,
    notifyEventIds: new Set(),
    waitlistEventIds: new Set(),
    ticketedEventIds: new Set(),
    attendedEventIds: new Set(),
  };
}

async function listAuthUsers(): Promise<{
  users: LegacyAuthUser[];
  warning: string | null;
}> {
  const supabase = getSupabaseClient();
  const users: LegacyAuthUser[] = [];
  const perPage = 1000;

  try {
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw error;
      }

      if (!data.users.length) {
        break;
      }

      users.push(...data.users);

      if (data.users.length < perPage) {
        break;
      }
    }

    return { users, warning: null };
  } catch (error) {
    console.error("Audience auth fetch error:", error);
    return {
      users: [],
      warning:
        "Auth records could not be loaded, so some accounts may be missing from this view.",
    };
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Valid event ID is required" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("audience.view", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const [
      selectedEvent,
      profileRows,
      roleRows,
      authUserResult,
      notifyRows,
      waitlistRows,
      ticketRows,
    ] = await Promise.all([
      db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          id: true,
          name: true,
          route: true,
          startTimeDate: true,
        },
      }),
      db.query.userProfiles.findMany({
        columns: {
          email: true,
          displayName: true,
          lastSignInAt: true,
          eduPersonAffiliation: true,
          eduPersonScopedAffiliation: true,
        },
      }),
      db.query.roles.findMany({
        columns: {
          email: true,
        },
      }),
      listAuthUsers(),
      db.query.notify.findMany({
        columns: {
          email: true,
          speakerId: true,
        },
      }),
      db.query.waitlist.findMany({
        columns: {
          email: true,
          eventId: true,
          name: true,
        },
      }),
      db.query.tickets.findMany({
        columns: {
          email: true,
          eventId: true,
          scanned: true,
          name: true,
        },
      }),
    ]);

    if (!selectedEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const usersByEmail = new Map<string, AudienceUserAccumulator>();

    for (const profile of profileRows) {
      const email = normalizeEmail(profile.email);
      const user = usersByEmail.get(email) ?? createUserAccumulator(email);
      user.displayName = user.displayName || profile.displayName || null;
      user.affiliation =
        user.affiliation === "missing"
          ? (getHighestAffiliation(
              [
                ...profile.eduPersonAffiliation,
                ...profile.eduPersonScopedAffiliation,
              ],
              AFFILIATION_PRIORITY,
            ) ?? "missing")
          : user.affiliation;
      user.lastLoginAt = getLaterIsoDate(
        user.lastLoginAt,
        profile.lastSignInAt?.toISOString() ?? null,
      );
      usersByEmail.set(email, user);
    }

    for (const roleRow of roleRows) {
      if (!roleRow.email) {
        continue;
      }

      const email = normalizeEmail(roleRow.email);
      const user = usersByEmail.get(email) ?? createUserAccumulator(email);
      usersByEmail.set(email, user);
    }

    for (const legacyUser of authUserResult.users) {
      if (!legacyUser.email) {
        continue;
      }

      const email = normalizeEmail(legacyUser.email);
      const user = usersByEmail.get(email) ?? createUserAccumulator(email);
      user.displayName = user.displayName || getLegacyDisplayName(legacyUser);
      user.lastLoginAt = getLaterIsoDate(
        user.lastLoginAt,
        legacyUser.last_sign_in_at ?? null,
      );
      usersByEmail.set(email, user);
    }

    for (const row of notifyRows) {
      const email = normalizeEmail(row.email);
      const user = usersByEmail.get(email) ?? createUserAccumulator(email);

      user.notifyEventIds.add(row.speakerId);
      usersByEmail.set(email, user);
    }

    for (const row of waitlistRows) {
      const email = normalizeEmail(row.email);
      const user = usersByEmail.get(email) ?? createUserAccumulator(email);

      user.displayName = user.displayName || row.name || null;

      if (!row.eventId) {
        usersByEmail.set(email, user);
        continue;
      }

      user.waitlistEventIds.add(row.eventId);
      usersByEmail.set(email, user);
    }

    for (const row of ticketRows) {
      const email = normalizeEmail(row.email);
      const user = usersByEmail.get(email) ?? createUserAccumulator(email);

      user.displayName = user.displayName || row.name || null;

      if (!row.eventId) {
        usersByEmail.set(email, user);
        continue;
      }

      user.ticketedEventIds.add(row.eventId);
      if (row.scanned) {
        user.attendedEventIds.add(row.eventId);
      }
      usersByEmail.set(email, user);
    }

    if (usersByEmail.size === 0) {
      return NextResponse.json({
        event: {
          id: selectedEvent.id,
          name: selectedEvent.name,
          route: selectedEvent.route,
          date: selectedEvent.startTimeDate?.toISOString() ?? null,
        },
        users: [],
        stats: {
          totalUsers: 0,
          currentEventNotifyUsers: 0,
          currentEventEngagedUsers: 0,
          usersWithAnyEventActivity: 0,
          affiliationCounts: {
            student: 0,
            faculty: 0,
            affiliate: 0,
            staff: 0,
            member: 0,
            missing: 0,
          },
        },
        warnings: authUserResult.warning ? [authUserResult.warning] : [],
      });
    }

    const users = Array.from(usersByEmail.values())
      .map((user) => {
        const historyEventIds = new Set([
          ...user.notifyEventIds,
          ...user.waitlistEventIds,
          ...user.ticketedEventIds,
          ...user.attendedEventIds,
        ]);

        return {
          email: user.email,
          displayName: user.displayName,
          affiliation: user.affiliation,
          lastLoginAt: user.lastLoginAt,
          currentEventStatus: {
            onNotifyList: user.notifyEventIds.has(eventId),
            waitlisted: user.waitlistEventIds.has(eventId),
            ticketed: user.ticketedEventIds.has(eventId),
            attended: user.attendedEventIds.has(eventId),
          },
          counts: {
            notified: user.notifyEventIds.size,
            waitlisted: user.waitlistEventIds.size,
            ticketed: user.ticketedEventIds.size,
            attended: user.attendedEventIds.size,
            totalHistoryEvents: historyEventIds.size,
          },
        };
      })
      .sort((a, b) => {
        const aCurrentScore =
          Number(a.currentEventStatus.attended) * 8 +
          Number(a.currentEventStatus.ticketed) * 4 +
          Number(a.currentEventStatus.waitlisted) * 2 +
          Number(a.currentEventStatus.onNotifyList);
        const bCurrentScore =
          Number(b.currentEventStatus.attended) * 8 +
          Number(b.currentEventStatus.ticketed) * 4 +
          Number(b.currentEventStatus.waitlisted) * 2 +
          Number(b.currentEventStatus.onNotifyList);

        if (bCurrentScore !== aCurrentScore) {
          return bCurrentScore - aCurrentScore;
        }

        if (b.counts.totalHistoryEvents !== a.counts.totalHistoryEvents) {
          return b.counts.totalHistoryEvents - a.counts.totalHistoryEvents;
        }

        const aLastLogin = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const bLastLogin = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;

        if (bLastLogin !== aLastLogin) {
          return bLastLogin - aLastLogin;
        }

        return (a.displayName || a.email).localeCompare(b.displayName || b.email);
      });

    const stats = users.reduce(
      (acc, user) => {
        const engagedWithCurrentEvent =
          user.currentEventStatus.onNotifyList ||
          user.currentEventStatus.waitlisted ||
          user.currentEventStatus.ticketed ||
          user.currentEventStatus.attended;

        acc.totalUsers++;
        if (user.currentEventStatus.onNotifyList) acc.currentEventNotifyUsers++;
        if (user.counts.totalHistoryEvents > 0) acc.usersWithAnyEventActivity++;
        if (engagedWithCurrentEvent) acc.currentEventEngagedUsers++;
        acc.affiliationCounts[user.affiliation]++;

        return acc;
      },
      {
        totalUsers: 0,
        currentEventNotifyUsers: 0,
        currentEventEngagedUsers: 0,
        usersWithAnyEventActivity: 0,
        affiliationCounts: {
          student: 0,
          faculty: 0,
          affiliate: 0,
          staff: 0,
          member: 0,
          missing: 0,
        },
      },
    );

    const warnings = authUserResult.warning ? [authUserResult.warning] : [];

    return NextResponse.json({
      event: {
        id: selectedEvent.id,
        name: selectedEvent.name,
        route: selectedEvent.route,
        date: selectedEvent.startTimeDate?.toISOString() ?? null,
      },
      users,
      stats,
      warnings,
    });
  } catch (error) {
    console.error("Audience data fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
