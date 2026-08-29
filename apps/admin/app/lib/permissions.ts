import { db, eq, permissionGrants } from "@ssb/db";
import {
  getRoleNamesForEmail,
  getSessionUser,
  normalizeEmail,
  type AdminVerificationResult,
} from "./auth";
import { getSupabaseClient } from "./supabase";

// ── Actions ──────────────────────────────────────────────────────────────────
// Each action is a capability. Event-scoped actions can be granted for a
// specific event or for ALL events (NULL scope). Global actions only make
// sense at the all-events / NULL scope.
export type PermissionAction =
  | "tickets.view"
  | "tickets.edit"
  | "tickets.delete"
  | "tickets.scan"
  | "questions.manage"
  | "suggestions.manage"
  | "events.create"
  | "events.edit"
  | "campaigns.send"
  | "audience.view";

type PermissionScope = "event" | "global";

export type PermissionDef = {
  action: PermissionAction;
  label: string;
  description: string;
  /** "event" → can be scoped to one event or all; "global" → all-events only. */
  scope: PermissionScope;
};

export const PERMISSION_DEFS: readonly PermissionDef[] = [
  {
    action: "tickets.view",
    label: "View tickets",
    description: "See the ticket list and look up attendees for an event.",
    scope: "event",
  },
  {
    action: "tickets.edit",
    label: "Edit tickets",
    description:
      "Create, rename, change type, cancel/uncancel tickets, and pull the waitlist.",
    scope: "event",
  },
  {
    action: "tickets.delete",
    label: "Delete tickets",
    description: "Permanently delete tickets for an event.",
    scope: "event",
  },
  {
    action: "tickets.scan",
    label: "Scan / check-in",
    description: "Scan QR codes and check attendees in at the door.",
    scope: "event",
  },
  {
    action: "questions.manage",
    label: "Manage Q&A",
    description: "Moderate audience questions (approve, hide, merge, sort).",
    scope: "event",
  },
  {
    action: "events.edit",
    label: "Edit event info",
    description: "Change an event's details, config, referrals, and toggles.",
    scope: "event",
  },
  {
    action: "campaigns.send",
    label: "Send campaigns",
    description: "Create and send email campaigns / notifications.",
    scope: "event",
  },
  {
    action: "audience.view",
    label: "View audience",
    description: "View audience, sales, attendance, feedback, and analytics.",
    scope: "event",
  },
  {
    action: "suggestions.manage",
    label: "Manage suggestions",
    description: "Approve, reject, and edit speaker suggestions.",
    scope: "global",
  },
  {
    action: "events.create",
    label: "Create events",
    description: "Create brand-new events.",
    scope: "global",
  },
];

// Higher-level capabilities imply lower ones: holding the key action also
// satisfies (and grants UI access for) every action it maps to.
export const PERMISSION_IMPLIES: Partial<
  Record<PermissionAction, PermissionAction[]>
> = {
  "tickets.edit": ["tickets.view"],
  "tickets.delete": ["tickets.view"],
};

/** Does a grant of `grantAction` satisfy a check for `target`? */
export function grantSatisfies(
  grantAction: string,
  target: PermissionAction,
): boolean {
  if (grantAction === target) return true;
  const implied = PERMISSION_IMPLIES[grantAction as PermissionAction];
  return implied ? implied.includes(target) : false;
}

const PERMISSION_ACTION_SET = new Set<string>(
  PERMISSION_DEFS.map((d) => d.action),
);
const EVENT_SCOPED_ACTION_SET = new Set<PermissionAction>(
  PERMISSION_DEFS.filter((d) => d.scope === "event").map((d) => d.action),
);

export function isPermissionAction(value: unknown): value is PermissionAction {
  return typeof value === "string" && PERMISSION_ACTION_SET.has(value);
}

export function getPermissionDef(action: PermissionAction): PermissionDef {
  return PERMISSION_DEFS.find((d) => d.action === action)!;
}

// ── Grant lookups ────────────────────────────────────────────────────────────

export type GrantRow = { action: string; eventId: string | null };

export async function getGrantsForEmail(email: string): Promise<GrantRow[]> {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  return db.query.permissionGrants.findMany({
    where: eq(permissionGrants.email, normalized),
    columns: { action: true, eventId: true },
  });
}

export async function isSuperAdmin(email: string): Promise<boolean> {
  const roles = await getRoleNamesForEmail(email);
  return roles.includes("admin");
}

/**
 * Core check. A super-admin passes everything. Otherwise a grant must exist for
 * `action` whose scope is NULL (all events / global) or matches `eventId`.
 *
 * For global actions, omit `eventId`; only a NULL-scope grant will match.
 */
export async function hasPermission(
  email: string,
  action: PermissionAction,
  eventId?: string | null,
): Promise<boolean> {
  if (!email) return false;
  if (await isSuperAdmin(email)) return true;

  const grants = await getGrantsForEmail(email);
  return grants.some(
    (g) =>
      grantSatisfies(g.action, action) &&
      (g.eventId === null || (eventId != null && g.eventId === eventId)),
  );
}

/**
 * Request guard that mirrors `verifyAdminRequest`'s shape so API routes can
 * swap one for the other with no other changes.
 */
export async function requirePermission(
  action: PermissionAction,
  eventId?: string | null,
): Promise<AdminVerificationResult> {
  const user = await getSessionUser();
  if (!user?.email) {
    return { authorized: false, error: "Not authenticated" };
  }

  const allowed = await hasPermission(user.email, action, eventId);
  if (!allowed) {
    return { authorized: false, error: "Not authorized" };
  }

  return {
    authorized: true,
    email: user.email,
    adminClient: getSupabaseClient(),
  };
}

/**
 * Guard for routes that accept several actions (e.g. an action that needs
 * either tickets.edit OR tickets.delete). Passes if ANY listed action is held.
 */
export async function requireAnyPermission(
  actions: PermissionAction[],
  eventId?: string | null,
): Promise<AdminVerificationResult> {
  const user = await getSessionUser();
  if (!user?.email) {
    return { authorized: false, error: "Not authenticated" };
  }

  if (await isSuperAdmin(user.email)) {
    return {
      authorized: true,
      email: user.email,
      adminClient: getSupabaseClient(),
    };
  }

  for (const action of actions) {
    if (await hasPermission(user.email, action, eventId)) {
      return {
        authorized: true,
        email: user.email,
        adminClient: getSupabaseClient(),
      };
    }
  }

  return { authorized: false, error: "Not authorized" };
}

/**
 * Guard for cross-event views (e.g. the campaigns list): passes if the user
 * holds `action` at ANY scope — a specific event, all events, or admin.
 */
export async function requireActionAnyScope(
  action: PermissionAction,
): Promise<AdminVerificationResult> {
  const user = await getSessionUser();
  if (!user?.email) {
    return { authorized: false, error: "Not authenticated" };
  }
  if (await isSuperAdmin(user.email)) {
    return {
      authorized: true,
      email: user.email,
      adminClient: getSupabaseClient(),
    };
  }
  const grants = await getGrantsForEmail(user.email);
  if (grants.some((g) => g.action === action)) {
    return {
      authorized: true,
      email: user.email,
      adminClient: getSupabaseClient(),
    };
  }
  return { authorized: false, error: "Not authorized" };
}

// ── Effective permissions (for UI gating) ────────────────────────────────────

export type EffectivePermissions = {
  isAdmin: boolean;
  /** Distinct actions the user holds at any scope. */
  actions: Set<PermissionAction>;
  /** Per-action set of event ids; presence of `null`-meaning handled by allEvents. */
  eventScopes: Map<PermissionAction, Set<string>>;
  /** Actions held with all-events (NULL) scope. */
  allEventActions: Set<PermissionAction>;
};

export async function getEffectivePermissions(
  email: string | null | undefined,
): Promise<EffectivePermissions> {
  const empty: EffectivePermissions = {
    isAdmin: false,
    actions: new Set(),
    eventScopes: new Map(),
    allEventActions: new Set(),
  };
  if (!email) return empty;

  if (await isSuperAdmin(email)) {
    return { ...empty, isAdmin: true };
  }

  const grants = await getGrantsForEmail(email);
  const actions = new Set<PermissionAction>();
  const eventScopes = new Map<PermissionAction, Set<string>>();
  const allEventActions = new Set<PermissionAction>();

  for (const g of grants) {
    if (!isPermissionAction(g.action)) continue;
    // Expand implied actions so nav/UI gating reflects the hierarchy
    // (e.g. tickets.edit also grants tickets.view access).
    const effective: PermissionAction[] = [
      g.action,
      ...(PERMISSION_IMPLIES[g.action] ?? []),
    ];
    for (const action of effective) {
      actions.add(action);
      if (g.eventId === null) {
        allEventActions.add(action);
      } else {
        const set = eventScopes.get(action) ?? new Set<string>();
        set.add(g.eventId);
        eventScopes.set(action, set);
      }
    }
  }

  return { isAdmin: false, actions, eventScopes, allEventActions };
}

/**
 * Convenience for server components: does the current session user hold
 * `action` at any scope (or is an admin)? Use for read-side page gating where
 * the mutating APIs enforce the real per-event boundary.
 */
export async function currentUserHoldsAction(
  action: PermissionAction,
): Promise<boolean> {
  const user = await getSessionUser();
  const perms = await getEffectivePermissions(user?.email);
  return perms.isAdmin || perms.actions.has(action);
}

export function hasAnyPermission(perms: EffectivePermissions): boolean {
  return perms.isAdmin || perms.actions.size > 0;
}

/**
 * Event ids the user may touch for any reason. `null` means "all events"
 * (super-admin or holds an all-events grant) — callers should not filter.
 */
export function permittedEventIds(
  perms: EffectivePermissions,
): Set<string> | null {
  if (perms.isAdmin) return null;
  for (const action of perms.allEventActions) {
    if (EVENT_SCOPED_ACTION_SET.has(action)) return null;
  }
  const ids = new Set<string>();
  for (const set of perms.eventScopes.values()) {
    for (const id of set) ids.add(id);
  }
  return ids;
}

export function permittedEventIdsForAction(
  perms: EffectivePermissions,
  action: PermissionAction,
): Set<string> | null {
  if (perms.isAdmin || perms.allEventActions.has(action)) return null;
  return new Set(perms.eventScopes.get(action) ?? []);
}

export function canUseActionForEvent(
  perms: EffectivePermissions,
  action: PermissionAction,
  eventId: string | null | undefined,
): boolean {
  if (perms.isAdmin || perms.allEventActions.has(action)) return true;
  if (!eventId) return false;
  return perms.eventScopes.get(action)?.has(eventId) ?? false;
}
