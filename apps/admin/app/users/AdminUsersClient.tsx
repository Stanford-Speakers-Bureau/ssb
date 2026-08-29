"use client";

import { useMemo, useState } from "react";

export type GrantChip = {
  id: string;
  action: string;
  eventId: string | null;
  eventName: string | null;
};

export type UnifiedUser = {
  email: string;
  /** roles-table row id (for adding/removing admin & scanner), or null. */
  roleRowId: string | null;
  isAdmin: boolean;
  isScanner: boolean;
  grants: GrantChip[];
};

export type Ban = { id: string; email: string; created_at: string };
export type FeeWaiver = { id: string; email: string; created_at: string };
export type EmailSuppression = {
  id: string;
  email: string;
  created_at: string;
};

export type EventOption = { id: string; name: string };

type PermDef = {
  action: string;
  label: string;
  description: string;
  scope: "event" | "global";
};

type Grantable = {
  key: string;
  label: string;
  description: string;
  scope: "event" | "global";
  kind: "role" | "permission";
};

type AdminUsersClientProps = {
  initialUsers: UnifiedUser[];
  initialBans: Ban[];
  initialFeeWaivers: FeeWaiver[];
  initialEmailSuppressions: EmailSuppression[];
  events: EventOption[];
  permissionDefs: PermDef[];
  /** action -> actions it implies (e.g. tickets.edit -> [tickets.view]). */
  implies: Record<string, string[]>;
};

type SimpleTab = "feeWaivers" | "bans" | "emailSuppressions";
type SimpleRoleType = "fee_waiver" | "ban" | "email_suppression";

export default function AdminUsersClient({
  initialUsers,
  initialBans,
  initialFeeWaivers,
  initialEmailSuppressions,
  events,
  permissionDefs,
  implies,
}: AdminUsersClientProps) {
  const [users, setUsers] = useState<UnifiedUser[]>(initialUsers);
  const [bans, setBans] = useState<Ban[]>(initialBans);
  const [feeWaivers, setFeeWaivers] = useState<FeeWaiver[]>(initialFeeWaivers);
  const [emailSuppressions, setEmailSuppressions] = useState<
    EmailSuppression[]
  >(initialEmailSuppressions);

  const [activeTab, setActiveTab] = useState<"users" | SimpleTab>("users");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Grantable catalog (admin & scanner are global roles; rest are perms) ──
  const grantables = useMemo<Grantable[]>(
    () => [
      {
        key: "admin",
        label: "Admin — full access",
        description: "Super-admin. Can do everything, including manage users.",
        scope: "global",
        kind: "role",
      },
      {
        key: "scanner",
        label: "Scanner — all events",
        description: "Legacy global door-scanning access across every event.",
        scope: "global",
        kind: "role",
      },
      ...permissionDefs.map<Grantable>((d) => ({
        key: d.action,
        label: d.label,
        description: d.description,
        scope: d.scope,
        kind: "permission",
      })),
    ],
    [permissionDefs],
  );
  const grantableByKey = useMemo(
    () => new Map(grantables.map((g) => [g.key, g])),
    [grantables],
  );

  // ── Grant form state (multi-select permissions + events) ──────────────────
  const [grantEmail, setGrantEmail] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  // Empty set = "all events" (including future).
  const [eventIds, setEventIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allEvents = eventIds.size === 0;
  const anyEventScoped = useMemo(
    () =>
      [...selectedPerms].some((k) => grantableByKey.get(k)?.scope === "event"),
    [selectedPerms, grantableByKey],
  );
  // Permissions auto-included by the current selection (e.g. selecting Edit
  // tickets includes View tickets). Shown checked + locked, not granted twice.
  const impliedSet = useMemo(() => {
    const s = new Set<string>();
    for (const k of selectedPerms)
      for (const imp of implies[k] ?? []) s.add(imp);
    return s;
  }, [selectedPerms, implies]);
  // How many grants the current selection produces per person.
  const perPersonGrantCount = useMemo(() => {
    const eventCount = allEvents ? 1 : eventIds.size;
    let n = 0;
    for (const k of selectedPerms) {
      const g = grantableByKey.get(k);
      if (g) n += g.scope === "event" ? eventCount : 1;
    }
    return n;
  }, [selectedPerms, allEvents, eventIds, grantableByKey]);

  function togglePerm(key: string) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleEvent(id: string) {
    setEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Simple-tab add form state ─────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState("");

  function upsertUser(email: string, mutate: (u: UnifiedUser) => void) {
    const key = email.trim().toLowerCase();
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.email === key);
      if (idx === -1) {
        const fresh: UnifiedUser = {
          email: key,
          roleRowId: null,
          isAdmin: false,
          isScanner: false,
          grants: [],
        };
        mutate(fresh);
        return [...prev, fresh].sort((a, b) => a.email.localeCompare(b.email));
      }
      const next = [...prev];
      const copy = { ...next[idx], grants: [...next[idx].grants] };
      mutate(copy);
      next[idx] = copy;
      return next;
    });
  }

  function pruneEmptyUser(email: string) {
    const key = email.trim().toLowerCase();
    setUsers((prev) =>
      prev.filter(
        (u) =>
          u.email !== key || u.isAdmin || u.isScanner || u.grants.length > 0,
      ),
    );
  }

  async function addRole(
    email: string,
    type: "admin" | "scanner",
    errors: string[],
  ): Promise<boolean> {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: [email], type, action: "add" }),
    });
    const data = await res.json();
    if (!res.ok) {
      errors.push(`${email} · ${type}: ${data.error || "Failed"}`);
      return false;
    }
    const row = (data.users ?? [])[0] as { id: string } | undefined;
    const errs = (data.errors ?? []) as Array<{ error: string }>;
    if (errs.length > 0 && !row) {
      errors.push(`${email} · ${type}: ${errs[0].error}`);
      return false;
    }
    upsertUser(email, (u) => {
      if (row?.id) u.roleRowId = row.id;
      if (type === "admin") u.isAdmin = true;
      else u.isScanner = true;
    });
    return true;
  }

  async function grantPermission(
    email: string,
    permission: string,
    eventId: string | null,
    errors: string[],
  ): Promise<boolean> {
    const res = await fetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "grant", email, permission, eventId }),
    });
    const data = await res.json();
    if (!res.ok) {
      const where = eventId
        ? (events.find((e) => e.id === eventId)?.name ?? "event")
        : "all events";
      errors.push(
        `${email} · ${permission} (${where}): ${data.error || "Failed"}`,
      );
      return false;
    }
    upsertUser(email, (u) =>
      u.grants.push({
        id: data.grant.id,
        action: data.grant.action,
        eventId: data.grant.eventId,
        eventName: eventId
          ? (events.find((e) => e.id === eventId)?.name ?? null)
          : null,
      }),
    );
    return true;
  }

  async function handleGrant() {
    const emails = grantEmail
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) {
      setError("Please enter at least one email address");
      return;
    }
    const invalid = emails.filter((e) => !e.includes("@"));
    if (invalid.length > 0) {
      setError(`Invalid email(s): ${invalid.join(", ")}`);
      return;
    }
    if (selectedPerms.size === 0) {
      setError("Select at least one permission");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    // Empty event selection = one all-events (null) grant.
    const targetEvents: (string | null)[] = allEvents ? [null] : [...eventIds];
    const errors: string[] = [];
    let granted = 0;

    for (const email of emails) {
      for (const key of selectedPerms) {
        const g = grantableByKey.get(key);
        if (!g) continue;
        try {
          if (g.kind === "role") {
            if (
              await addRole(
                email,
                key === "admin" ? "admin" : "scanner",
                errors,
              )
            )
              granted++;
          } else if (g.scope === "global") {
            if (await grantPermission(email, key, null, errors)) granted++;
          } else {
            for (const ev of targetEvents) {
              if (await grantPermission(email, key, ev, errors)) granted++;
            }
          }
        } catch {
          errors.push(`${email} · ${key}: Request failed`);
        }
      }
    }

    if (granted > 0) {
      setGrantEmail("");
      setSuccess(`Created ${granted} grant(s)`);
    }
    if (errors.length > 0) setError(errors.join("; "));
    setIsSubmitting(false);
  }

  async function handleRevokeRole(
    user: UnifiedUser,
    role: "admin" | "scanner",
  ) {
    if (!user.roleRowId) return;
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.roleRowId,
          type: role === "admin" ? "admin" : "scanner",
          action: "remove",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to revoke");
        return;
      }
      upsertUser(user.email, (u) => {
        if (role === "admin") u.isAdmin = false;
        else u.isScanner = false;
      });
      pruneEmptyUser(user.email);
      setSuccess(`Removed ${role} from ${user.email}`);
    } catch {
      setError("Failed to revoke. Please try again.");
    }
  }

  async function handleRevokeGrant(user: UnifiedUser, grant: GrantChip) {
    try {
      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", id: grant.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to revoke");
        return;
      }
      upsertUser(user.email, (u) => {
        u.grants = u.grants.filter((g) => g.id !== grant.id);
      });
      pruneEmptyUser(user.email);
      setSuccess("Permission revoked");
    } catch {
      setError("Failed to revoke. Please try again.");
    }
  }

  function grantScopeLabel(g: GrantChip): string {
    const def = grantableByKey.get(g.action);
    if (def?.scope === "global") return "Global";
    return g.eventId ? (g.eventName ?? "Unknown event") : "All events";
  }
  function grantLabel(g: GrantChip): string {
    return grantableByKey.get(g.action)?.label.split(" — ")[0] ?? g.action;
  }

  // ── Simple tabs (fee waiver / banned / email suppression) ─────────────────
  const simpleType: SimpleRoleType =
    activeTab === "feeWaivers"
      ? "fee_waiver"
      : activeTab === "bans"
        ? "ban"
        : "email_suppression";

  async function handleAddSimple() {
    const emails = newEmail
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) {
      setError("Please enter an email address");
      return;
    }
    const invalid = emails.filter((e) => !e.includes("@"));
    if (invalid.length > 0) {
      setError(`Invalid email(s): ${invalid.join(", ")}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, type: simpleType, action: "add" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add");
        setIsSubmitting(false);
        return;
      }
      const created = (data.users ?? []) as Array<{
        id: string;
        email: string | null;
        created_at: string;
      }>;
      const rows = created.map((r) => ({
        id: r.id,
        email: r.email ?? "",
        created_at: r.created_at,
      }));
      if (activeTab === "feeWaivers") setFeeWaivers((p) => [...rows, ...p]);
      else if (activeTab === "bans") setBans((p) => [...rows, ...p]);
      else setEmailSuppressions((p) => [...rows, ...p]);

      const errs = (data.errors ?? []) as Array<{
        email: string;
        error: string;
      }>;
      if (errs.length > 0) {
        setError(errs.map((e) => `${e.email}: ${e.error}`).join("; "));
      }
      if (rows.length > 0) {
        setSuccess(`Added ${rows.length} entry(ies)`);
        if (errs.length === 0) setNewEmail("");
      }
    } catch {
      setError("Failed to add. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveSimple(id: string) {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: simpleType, action: "remove" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to remove");
        return;
      }
      if (activeTab === "feeWaivers")
        setFeeWaivers((p) => p.filter((r) => r.id !== id));
      else if (activeTab === "bans")
        setBans((p) => p.filter((r) => r.id !== id));
      else setEmailSuppressions((p) => p.filter((r) => r.id !== id));
      setSuccess("Removed");
    } catch {
      setError("Failed to remove. Please try again.");
    }
  }

  const simpleRows: Array<{ id: string; email: string; created_at: string }> =
    activeTab === "feeWaivers"
      ? feeWaivers
      : activeTab === "bans"
        ? bans
        : emailSuppressions;

  const tabBtn = (key: "users" | SimpleTab, label: string, count: number) => {
    const isActive = activeTab === key;
    return (
      <button
        type="button"
        onClick={() => {
          setActiveTab(key);
          setError(null);
          setSuccess(null);
        }}
        className={`-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap ${
          isActive
            ? "border-rose-500 text-white"
            : "border-transparent text-zinc-400 hover:text-zinc-200"
        }`}
      >
        {label}
        <span
          className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
            isActive
              ? "bg-rose-500/15 text-rose-300"
              : "bg-white/5 text-zinc-400"
          }`}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-balance text-white sm:text-3xl">
          Users &amp; permissions
        </h1>
        <p className="mt-2 max-w-prose text-sm text-pretty text-zinc-400">
          Grant people targeted access — admin, scanning, or fine-grained
          per-event permissions. Fee waivers, bans, and email suppression are
          managed in their own tabs.
        </p>
      </header>

      <div className="mb-8 flex flex-wrap gap-x-6 border-b border-white/10">
        {tabBtn("users", "Users & permissions", users.length)}
        {tabBtn("feeWaivers", "Fee waiver", feeWaivers.length)}
        {tabBtn("bans", "Banned", bans.length)}
        {tabBtn(
          "emailSuppressions",
          "Email suppression",
          emailSuppressions.length,
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-rose-500/10 p-3.5 ring-1 ring-inset ring-rose-500/25">
          <p className="flex-1 text-sm text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className="text-rose-400 hover:text-rose-300"
          >
            ✕
          </button>
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-emerald-500/10 p-3.5 ring-1 ring-inset ring-emerald-500/25">
          <p className="flex-1 text-sm text-emerald-300">{success}</p>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            aria-label="Dismiss"
            className="text-emerald-400 hover:text-emerald-300"
          >
            ✕
          </button>
        </div>
      )}

      {activeTab === "users" ? (
        <>
          {/* Grant form */}
          <section className="mb-8 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">Grant access</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Choose people, one or more permissions, and the events they apply
              to.
            </p>

            <div className="mt-5 space-y-6">
              {/* People */}
              <div>
                <label
                  htmlFor="grant-people"
                  className="text-xs font-medium tracking-wide text-zinc-400"
                >
                  People
                </label>
                <input
                  id="grant-people"
                  name="people"
                  type="text"
                  placeholder="person@stanford.edu, other@stanford.edu"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-rose-500 max-sm:text-base"
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                  Separate multiple emails with commas.
                </p>
              </div>

              {/* Permissions */}
              <div>
                <p className="text-xs font-medium tracking-wide text-zinc-400">
                  Permissions
                </p>
                <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(["global", "event"] as const).map((scope) => (
                    <div
                      key={scope}
                      className="rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/10"
                    >
                      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                        {scope === "global" ? "Global" : "Per-event"}
                      </p>
                      <div className="mt-3 space-y-2.5">
                        {grantables
                          .filter((g) => g.scope === scope)
                          .map((g) => {
                            const checked = selectedPerms.has(g.key);
                            const included = impliedSet.has(g.key) && !checked;
                            return (
                              <label
                                key={g.key}
                                title={g.description}
                                className={`flex items-center gap-2.5 text-sm ${
                                  included
                                    ? "text-zinc-500"
                                    : "cursor-pointer text-zinc-200"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="size-5 shrink-0 rounded accent-rose-500 sm:size-4"
                                  checked={checked || included}
                                  disabled={included}
                                  onChange={() => togglePerm(g.key)}
                                />
                                <span>
                                  {g.label}
                                  {included && (
                                    <span className="text-zinc-500">
                                      {" "}
                                      · included
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scope */}
              <div>
                <p className="text-xs font-medium tracking-wide text-zinc-400">
                  Scope
                </p>
                {anyEventScoped ? (
                  <div className="mt-1.5 rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                    <div className="grid max-h-56 grid-cols-1 gap-x-6 gap-y-2.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-200">
                        <input
                          type="checkbox"
                          className="size-5 shrink-0 rounded accent-rose-500 sm:size-4"
                          checked={allEvents}
                          onChange={() => setEventIds(new Set())}
                        />
                        <span>
                          All events{" "}
                          <span className="text-zinc-500">· incl. future</span>
                        </span>
                      </label>
                      {events.map((ev) => (
                        <label
                          key={ev.id}
                          className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-200"
                        >
                          <input
                            type="checkbox"
                            className="size-5 shrink-0 rounded accent-rose-500 sm:size-4"
                            checked={eventIds.has(ev.id)}
                            onChange={() => toggleEvent(ev.id)}
                          />
                          <span className="truncate">{ev.name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">
                      {allEvents
                        ? "Applies to every event, including future ones."
                        : `Applies to ${eventIds.size} selected event(s) — each event × permission becomes its own grant.`}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm text-zinc-500">
                    The selected permissions apply globally — no event scope
                    needed.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
              <p className="text-xs text-zinc-500">
                {selectedPerms.size === 0
                  ? "Select at least one permission."
                  : `${perPersonGrantCount} grant(s) per person.`}
              </p>
              <button
                type="button"
                onClick={handleGrant}
                disabled={isSubmitting}
                className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50"
              >
                {isSubmitting ? "Granting…" : "Grant access"}
              </button>
            </div>
          </section>

          {/* One entry per user */}
          {users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
              <p className="text-sm font-medium text-zinc-300">
                No users with access yet
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Grant a permission above to get started.
              </p>
            </div>
          ) : (
            <ul
              role="list"
              className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60"
            >
              {users.map((user) => (
                <li
                  key={user.email}
                  className="flex items-start gap-4 p-4 sm:p-5"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-zinc-300"
                  >
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {user.email}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {user.isAdmin && (
                        <Chip
                          actionKey="admin"
                          label="Admin"
                          scope="Full access"
                          onRemove={() => handleRevokeRole(user, "admin")}
                        />
                      )}
                      {user.isScanner && (
                        <Chip
                          actionKey="scanner"
                          label="Scanner"
                          scope="All events"
                          onRemove={() => handleRevokeRole(user, "scanner")}
                        />
                      )}
                      {user.grants.map((g) => (
                        <Chip
                          key={g.id}
                          actionKey={g.action}
                          label={grantLabel(g)}
                          scope={grantScopeLabel(g)}
                          onRemove={() => handleRevokeGrant(user, g)}
                        />
                      ))}
                      {!user.isAdmin &&
                        !user.isScanner &&
                        user.grants.length === 0 && (
                          <span className="text-sm text-zinc-500">
                            No active permissions
                          </span>
                        )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {/* Simple add form */}
          <section className="mb-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">
              {activeTab === "feeWaivers"
                ? "Add fee waiver"
                : activeTab === "bans"
                  ? "Ban a user"
                  : "Suppress an email address"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Separate multiple emails with commas.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                name="email"
                aria-label="Email addresses"
                placeholder="person@stanford.edu, other@stanford.edu"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSimple()}
                className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-rose-500 max-sm:text-base"
              />
              <button
                type="button"
                onClick={handleAddSimple}
                disabled={isSubmitting}
                className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50"
              >
                {isSubmitting ? "Adding…" : "Add"}
              </button>
            </div>
          </section>

          {simpleRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
              <p className="text-sm font-medium text-zinc-300">
                Nothing here yet
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Add an email above to populate this list.
              </p>
            </div>
          ) : (
            <ul
              role="list"
              className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60"
            >
              {simpleRows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 p-4 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {row.email}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Added{" "}
                      {new Date(row.created_at).toLocaleDateString("en-US", {
                        timeZone: "America/Los_Angeles",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSimple(row.id)}
                    className="shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-rose-400"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const DOT_COLORS: Record<string, string> = {
  admin: "bg-rose-400",
  scanner: "bg-sky-400",
  "tickets.view": "bg-emerald-400",
  "tickets.edit": "bg-emerald-400",
  "tickets.delete": "bg-emerald-400",
  "tickets.scan": "bg-emerald-400",
  "questions.manage": "bg-violet-400",
  "suggestions.manage": "bg-amber-400",
  "events.create": "bg-blue-400",
  "events.edit": "bg-blue-400",
  "campaigns.send": "bg-pink-400",
  "audience.view": "bg-teal-400",
};

function Chip({
  actionKey,
  label,
  scope,
  onRemove,
}: {
  actionKey: string;
  label: string;
  scope: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 py-1 pr-1 pl-2 text-xs ring-1 ring-inset ring-white/10">
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${DOT_COLORS[actionKey] ?? "bg-zinc-400"}`}
      />
      <span className="font-medium text-zinc-200">{label}</span>
      <span className="text-zinc-500">{scope}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Revoke ${label}`}
        title="Revoke"
        className="ml-0.5 flex size-4 items-center justify-center rounded text-zinc-500 hover:bg-white/10 hover:text-rose-400"
      >
        ✕
      </button>
    </span>
  );
}
