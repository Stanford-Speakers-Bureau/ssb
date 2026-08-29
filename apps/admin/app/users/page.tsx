import AdminUsersClient, {
  type Ban,
  type EmailSuppression,
  type EventOption,
  type FeeWaiver,
  type GrantChip,
  type UnifiedUser,
} from "./AdminUsersClient";
import {
  hasRoleName,
  parseRoleNames,
  verifyAdminRequest,
} from "@/app/lib/auth";
import { PERMISSION_DEFS, PERMISSION_IMPLIES } from "@/app/lib/permissions";
import { db, desc } from "@ssb/db";
import { connection } from "next/server";

export const dynamic = "force-dynamic";

type InitialData = {
  users: UnifiedUser[];
  bans: Ban[];
  feeWaivers: FeeWaiver[];
  emailSuppressions: EmailSuppression[];
  events: EventOption[];
};

async function getInitialData(): Promise<InitialData> {
  const empty: InitialData = {
    users: [],
    bans: [],
    feeWaivers: [],
    emailSuppressions: [],
    events: [],
  };

  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) return empty;

    const [allRoles, grantRows, eventRows] = await Promise.all([
      db.query.roles.findMany({ orderBy: (t) => [desc(t.createdAt)] }),
      db.query.permissionGrants.findMany({
        orderBy: (t) => [desc(t.createdAt)],
      }),
      db.query.events.findMany({
        columns: { id: true, name: true, startTimeDate: true },
        orderBy: (t, { desc: d }) => [d(t.startTimeDate)],
      }),
    ]);

    const serializedRoles = allRoles.map((r) => ({
      id: r.id,
      created_at: r.createdAt.toISOString(),
      email: r.email,
      roles: r.roles,
    }));

    const bans = serializedRoles.filter((r) => hasRoleName(r.roles, "banned"));
    const feeWaivers = serializedRoles.filter((r) =>
      hasRoleName(r.roles, "fee_waiver"),
    );
    const emailSuppressions = serializedRoles.filter((r) =>
      hasRoleName(r.roles, "email_suppression"),
    );

    const eventNameById = new Map(eventRows.map((e) => [e.id, e.name]));

    // Build one entry per person, keyed by lowercased email. Seed from the
    // roles table (admin / scanner) and from permission grants.
    const byEmail = new Map<string, UnifiedUser>();
    const ensure = (email: string): UnifiedUser => {
      const key = email.trim().toLowerCase();
      let entry = byEmail.get(key);
      if (!entry) {
        entry = {
          email: key,
          roleRowId: null,
          isAdmin: false,
          isScanner: false,
          grants: [],
        };
        byEmail.set(key, entry);
      }
      return entry;
    };

    for (const row of serializedRoles) {
      if (!row.email) continue;
      const names = parseRoleNames(row.roles);
      const isAdmin = names.includes("admin");
      const isScanner = names.includes("scanner");
      if (!isAdmin && !isScanner) continue;
      const entry = ensure(row.email);
      entry.roleRowId = row.id;
      entry.isAdmin = isAdmin;
      entry.isScanner = isScanner;
    }

    for (const g of grantRows) {
      const entry = ensure(g.email);
      const chip: GrantChip = {
        id: g.id,
        action: g.action,
        eventId: g.eventId,
        eventName: g.eventId
          ? (eventNameById.get(g.eventId) ?? "Unknown event")
          : null,
      };
      entry.grants.push(chip);
    }

    const users = [...byEmail.values()].sort((a, b) =>
      a.email.localeCompare(b.email),
    );

    return {
      users,
      bans: bans as Ban[],
      feeWaivers: feeWaivers as FeeWaiver[],
      emailSuppressions: emailSuppressions as EmailSuppression[],
      events: eventRows.map((e) => ({
        id: e.id,
        name: e.name || "Unnamed Event",
      })),
    };
  } catch (error) {
    console.error("Failed to fetch initial users:", error);
    return empty;
  }
}

export default async function AdminUsersPage() {
  await connection();
  const { users, bans, feeWaivers, emailSuppressions, events } =
    await getInitialData();
  return (
    <AdminUsersClient
      initialUsers={users}
      initialBans={bans}
      initialFeeWaivers={feeWaivers}
      initialEmailSuppressions={emailSuppressions}
      events={events}
      permissionDefs={PERMISSION_DEFS.map((d) => ({
        action: d.action,
        label: d.label,
        description: d.description,
        scope: d.scope,
      }))}
      implies={PERMISSION_IMPLIES as Record<string, string[]>}
    />
  );
}
