"use client";

import { useEffect, useMemo, useState } from "react";
import { useEventContext } from "../EventContext";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tab,
  Tabs,
} from "@/app/components/ui";

type AnnounceRow = {
  email: string;
  displayEmail: string;
  source: string;
};

type UnsubRow = {
  id: string;
  email: string;
  scope: "announce" | "event" | "newsletter";
  eventId: string | null;
  source: string;
  reason: string | null;
  actor: string;
  createdAt: string;
};

type EventOption = {
  id: string;
  name: string;
  startTime: string | null;
};

type Stats = {
  total: number;
  optedOut: number;
};

type Props = {
  initialRows: AnnounceRow[];
  initialTotal: number;
  initialOptOuts: UnsubRow[];
  initialStats: Stats;
  initialNewsletterOptOuts: UnsubRow[];
  initialNewsletterStats: Stats;
  events: EventOption[];
  initialLimit: number;
};

type Tab = "announce" | "newsletter" | "event";

export default function MailingListsClient({
  initialRows,
  initialTotal,
  initialOptOuts,
  initialStats,
  initialNewsletterOptOuts,
  initialNewsletterStats,
  events,
  initialLimit,
}: Props) {
  const { selectedEventId } = useEventContext();
  const [tab, setTab] = useState<Tab>("announce");

  // Announce tab state
  const [announceRows, setAnnounceRows] = useState<AnnounceRow[]>(initialRows);
  const [announceTotal, setAnnounceTotal] = useState<number>(initialTotal);
  const [announceOptOuts, setAnnounceOptOuts] =
    useState<UnsubRow[]>(initialOptOuts);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(initialLimit);
  const [loadingAnnounce, setLoadingAnnounce] = useState(false);

  // Newsletter tab state
  const [newsletterOptOuts, setNewsletterOptOuts] = useState<UnsubRow[]>(
    initialNewsletterOptOuts,
  );
  const [newsletterStats, setNewsletterStats] = useState<Stats>(
    initialNewsletterStats,
  );
  const [loadingNewsletter, setLoadingNewsletter] = useState(false);
  const [newsletterAddEmail, setNewsletterAddEmail] = useState("");
  const [newsletterAddReason, setNewsletterAddReason] = useState("");

  // Event tab state
  const [eventTabId, setEventTabId] = useState<string>(selectedEventId ?? "");
  const [eventOptOuts, setEventOptOuts] = useState<UnsubRow[]>([]);
  const [eventName, setEventName] = useState<string>("");
  const [loadingEvent, setLoadingEvent] = useState(false);

  // Modal / shared state
  const [actionEmail, setActionEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual-add (event tab) state
  const [addEmail, setAddEmail] = useState("");
  const [addReason, setAddReason] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch]);

  useEffect(() => {
    if (tab !== "announce") return;
    let cancelled = false;
    (async () => {
      setLoadingAnnounce(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          view: "announce",
          limit: String(limit),
          offset: String(offset),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res = await fetch(`/api/mailing-lists?${params.toString()}`);
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        const data = await res.json();
        if (cancelled) return;
        setAnnounceRows(data.rows);
        setAnnounceTotal(data.total);
        setAnnounceOptOuts(data.optOuts);
        setStats(data.stats);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoadingAnnounce(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, debouncedSearch, offset, limit]);

  useEffect(() => {
    if (tab !== "newsletter") return;
    let cancelled = false;
    (async () => {
      setLoadingNewsletter(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/mailing-lists?view=newsletter&limit=1&offset=0`,
        );
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        const data = await res.json();
        if (cancelled) return;
        setNewsletterOptOuts(data.optOuts);
        setNewsletterStats(data.stats);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoadingNewsletter(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== "event" || !eventTabId) return;
    let cancelled = false;
    (async () => {
      setLoadingEvent(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/mailing-lists?view=event&eventId=${encodeURIComponent(eventTabId)}`,
        );
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        const data = await res.json();
        if (cancelled) return;
        setEventOptOuts(data.optOuts);
        setEventName(data.event?.name ?? "");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoadingEvent(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, eventTabId]);

  async function refreshAnnounce() {
    const params = new URLSearchParams({
      view: "announce",
      limit: String(limit),
      offset: String(offset),
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    const res = await fetch(`/api/mailing-lists?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    setAnnounceRows(data.rows);
    setAnnounceTotal(data.total);
    setAnnounceOptOuts(data.optOuts);
    setStats(data.stats);
  }

  async function refreshNewsletter() {
    const res = await fetch(
      `/api/mailing-lists?view=newsletter&limit=1&offset=0`,
    );
    if (!res.ok) return;
    const data = await res.json();
    setNewsletterOptOuts(data.optOuts);
    setNewsletterStats(data.stats);
  }

  async function refreshEvent(eventId: string) {
    const res = await fetch(
      `/api/mailing-lists?view=event&eventId=${encodeURIComponent(eventId)}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    setEventOptOuts(data.optOuts);
    setEventName(data.event?.name ?? "");
  }

  async function handleAdminUnsubscribe(opts: {
    scope: "announce" | "event" | "newsletter";
    email: string;
    eventId?: string;
    reason?: string;
  }) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/mailing-lists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "unsubscribe", ...opts }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Failed to unsubscribe");
      }
      setSuccess(`${opts.email} unsubscribed`);
      if (opts.scope === "announce") await refreshAnnounce();
      else if (opts.scope === "newsletter") await refreshNewsletter();
      else if (opts.eventId) await refreshEvent(opts.eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
      setActionEmail(null);
    }
  }

  async function handleAdminResubscribe(opts: {
    scope: "announce" | "event" | "newsletter";
    email: string;
    eventId?: string;
  }) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/mailing-lists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resubscribe", ...opts }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Failed to resubscribe");
      }
      setSuccess(`${opts.email} resubscribed`);
      if (opts.scope === "announce") await refreshAnnounce();
      else if (opts.scope === "newsletter") await refreshNewsletter();
      else if (opts.eventId) await refreshEvent(opts.eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  const announceCounts = useMemo(
    () => ({
      receiving: stats.total,
      optedOut: stats.optedOut,
    }),
    [stats],
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          className="mb-6"
          title="Mailing lists"
          subtitle="View the announce list and per-event opt-outs. Manual unsubscribe / resubscribe is logged to the audit trail."
        />

        {(error || success) && (
          <Alert className="mb-4" tone={error ? "error" : "success"}>
            {error || success}
          </Alert>
        )}

        <Tabs wrap className="mb-6">
          <Tab active={tab === "announce"} onClick={() => setTab("announce")}>
            Announce
          </Tab>
          <Tab
            active={tab === "newsletter"}
            onClick={() => setTab("newsletter")}
          >
            Newsletter
          </Tab>
          <Tab active={tab === "event"} onClick={() => setTab("event")}>
            Per-event opt-outs
          </Tab>
        </Tabs>

        {tab === "announce" && (
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <StatCard
                label="On announce"
                value={announceCounts.receiving.toLocaleString()}
                tone="emerald"
              />
              <StatCard
                label="Opted out of announce"
                value={announceCounts.optedOut.toLocaleString()}
                tone="rose"
              />
              <StatCard
                label="Unique emails total"
                value={(
                  announceCounts.receiving + announceCounts.optedOut
                ).toLocaleString()}
                tone="zinc"
              />
            </div>

            <div className="mb-3 flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
              <Input
                type="text"
                aria-label="Search emails"
                placeholder="Search emails…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sm:max-w-sm"
              />
              <div className="text-xs text-zinc-500">
                {loadingAnnounce
                  ? "Loading…"
                  : `${announceTotal.toLocaleString()} matches`}
              </div>
            </div>

            <div className="mb-4">
              <TableScroll>
                <Table>
                  <THead>
                    <TR className="border-b border-white/10">
                      <TH>Email</TH>
                      <TH>Source</TH>
                      <TH className="w-32 text-right" />
                    </TR>
                  </THead>
                  <TBody>
                    {announceRows.map((row) => (
                      <TR key={row.email} className="hover:bg-white/[0.02]">
                        <TD className="font-mono text-xs">
                          <div>{row.displayEmail}</div>
                          {row.displayEmail.toLowerCase() !== row.email && (
                            <div className="text-[10px] text-zinc-500">
                              canonical: {row.email}
                            </div>
                          )}
                        </TD>
                        <TD className="text-xs text-zinc-400">{row.source}</TD>
                        <TD className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => setActionEmail(row.email)}
                          >
                            Unsubscribe
                          </Button>
                        </TD>
                      </TR>
                    ))}
                    {!loadingAnnounce && announceRows.length === 0 && (
                      <TR>
                        <TD
                          className="py-6 text-center text-zinc-500"
                          colSpan={3}
                        >
                          No emails match.
                        </TD>
                      </TR>
                    )}
                  </TBody>
                </Table>
              </TableScroll>
            </div>

            <div className="flex items-center justify-between mb-10">
              <Button
                variant="secondary"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0 || loadingAnnounce}
                className="disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </Button>
              <span className="text-xs text-zinc-500">
                {offset + 1}–
                {Math.min(offset + announceRows.length, announceTotal)} of{" "}
                {announceTotal.toLocaleString()}
              </span>
              <Button
                variant="secondary"
                onClick={() => setOffset(offset + limit)}
                disabled={
                  offset + announceRows.length >= announceTotal ||
                  loadingAnnounce
                }
                className="disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </Button>
            </div>

            <h2 className="text-base font-semibold text-white mb-3">
              Announce opt-outs
              <span className="ml-2 text-zinc-500 font-normal text-sm">
                ({announceOptOuts.length})
              </span>
            </h2>
            <OptOutTable
              rows={announceOptOuts}
              showEvent={false}
              onResubscribe={(row) =>
                handleAdminResubscribe({
                  scope: "announce",
                  email: row.email,
                })
              }
              submitting={submitting}
            />
          </section>
        )}

        {tab === "newsletter" && (
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <StatCard
                label="Receiving newsletter"
                value={newsletterStats.total.toLocaleString()}
                tone="emerald"
              />
              <StatCard
                label="Opted out of newsletter"
                value={newsletterStats.optedOut.toLocaleString()}
                tone="rose"
              />
              <StatCard
                label="Unique emails total"
                value={(
                  newsletterStats.total + newsletterStats.optedOut
                ).toLocaleString()}
                tone="zinc"
              />
            </div>

            <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
              The newsletter list is everyone in the mailing list minus announce
              opt-outs and newsletter opt-outs. People who opt out of just the
              newsletter still receive new-speaker announcements and event mail.
            </p>

            <Card className="mb-4">
              <h3 className="text-sm font-semibold text-white mb-3">
                Manually opt someone out of the newsletter
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  aria-label="Email address"
                  placeholder="email@stanford.edu"
                  value={newsletterAddEmail}
                  onChange={(e) => setNewsletterAddEmail(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="text"
                  aria-label="Reason"
                  placeholder="Reason (optional)"
                  value={newsletterAddReason}
                  onChange={(e) => setNewsletterAddReason(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="primary"
                  disabled={!newsletterAddEmail.trim() || submitting}
                  onClick={async () => {
                    await handleAdminUnsubscribe({
                      scope: "newsletter",
                      email: newsletterAddEmail.trim(),
                      reason: newsletterAddReason.trim() || undefined,
                    });
                    setNewsletterAddEmail("");
                    setNewsletterAddReason("");
                  }}
                >
                  Add opt-out
                </Button>
              </div>
            </Card>

            <h2 className="text-base font-semibold text-white mb-3">
              Newsletter opt-outs
              <span className="ml-2 text-zinc-500 font-normal text-sm">
                ({newsletterOptOuts.length})
              </span>
            </h2>
            {loadingNewsletter ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : (
              <OptOutTable
                rows={newsletterOptOuts}
                showEvent={false}
                onResubscribe={(row) =>
                  handleAdminResubscribe({
                    scope: "newsletter",
                    email: row.email,
                  })
                }
                submitting={submitting}
              />
            )}
          </section>
        )}

        {tab === "event" && (
          <section>
            <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div>
                <Label htmlFor="event-select" className="mb-1 block">
                  Event
                </Label>
                <Select
                  id="event-select"
                  value={eventTabId}
                  onChange={(e) => setEventTabId(e.target.value)}
                  className="min-w-[280px]"
                >
                  <option value="">Select an event…</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                      {e.startTime
                        ? ` — ${new Date(e.startTime).toLocaleDateString()}`
                        : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {!eventTabId && (
              <p className="text-sm text-zinc-500">
                Pick an event to see its opt-out roster.
              </p>
            )}

            {eventTabId && (
              <>
                <Card className="mb-4">
                  <h3 className="text-sm font-semibold text-white mb-3">
                    Manually opt someone out of {eventName || "this event"}
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="email"
                      aria-label="Email address"
                      placeholder="email@stanford.edu"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="text"
                      aria-label="Reason"
                      placeholder="Reason (optional)"
                      value={addReason}
                      onChange={(e) => setAddReason(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="primary"
                      disabled={!addEmail.trim() || submitting}
                      onClick={async () => {
                        await handleAdminUnsubscribe({
                          scope: "event",
                          email: addEmail.trim(),
                          eventId: eventTabId,
                          reason: addReason.trim() || undefined,
                        });
                        setAddEmail("");
                        setAddReason("");
                      }}
                    >
                      Add opt-out
                    </Button>
                  </div>
                </Card>

                <h2 className="text-base font-semibold text-white mb-3">
                  Opt-outs for {eventName || "event"}
                  <span className="ml-2 text-zinc-500 font-normal text-sm">
                    ({eventOptOuts.length})
                  </span>
                </h2>
                {loadingEvent ? (
                  <p className="text-sm text-zinc-500">Loading…</p>
                ) : (
                  <OptOutTable
                    rows={eventOptOuts}
                    showEvent={false}
                    onResubscribe={(row) =>
                      handleAdminResubscribe({
                        scope: "event",
                        email: row.email,
                        eventId: eventTabId,
                      })
                    }
                    submitting={submitting}
                  />
                )}
              </>
            )}
          </section>
        )}

        {actionEmail && (
          <ConfirmModal
            email={actionEmail}
            onCancel={() => setActionEmail(null)}
            onConfirm={(reason) =>
              handleAdminUnsubscribe({
                scope: "announce",
                email: actionEmail,
                reason: reason || undefined,
              })
            }
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "rose" | "zinc";
}) {
  const valueClass = {
    emerald: "text-emerald-400",
    rose: "text-rose-400",
    zinc: "text-zinc-300",
  }[tone];
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
      <div className="text-xs font-medium tracking-wide text-zinc-400">
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function OptOutTable({
  rows,
  showEvent,
  onResubscribe,
  submitting,
}: {
  rows: UnsubRow[];
  showEvent: boolean;
  onResubscribe: (row: UnsubRow) => void;
  submitting: boolean;
}) {
  return (
    <TableScroll>
      <Table>
        <THead>
          <TR className="border-b border-white/10">
            <TH>Email</TH>
            <TH>Source</TH>
            <TH>Reason</TH>
            <TH>When</TH>
            {showEvent && <TH>Event</TH>}
            <TH className="w-32 text-right" />
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id} className="hover:bg-white/[0.02]">
              <TD className="font-mono text-xs">{row.email}</TD>
              <TD className="text-zinc-400">{row.source}</TD>
              <TD className="text-zinc-400">{row.reason || "—"}</TD>
              <TD className="text-zinc-500 text-xs">
                {new Date(row.createdAt).toLocaleString()}
              </TD>
              {showEvent && (
                <TD className="text-zinc-400 text-xs">{row.eventId ?? "—"}</TD>
              )}
              <TD className="text-right">
                <Button
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => onResubscribe(row)}
                  className="disabled:opacity-40"
                >
                  Resubscribe
                </Button>
              </TD>
            </TR>
          ))}
          {rows.length === 0 && (
            <TR>
              <TD
                className="py-6 text-center text-zinc-500"
                colSpan={showEvent ? 6 : 5}
              >
                No opt-outs yet.
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
    </TableScroll>
  );
}

function ConfirmModal({
  email,
  onCancel,
  onConfirm,
  submitting,
}: {
  email: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6">
        <h3 className="text-base font-semibold text-white mb-2">
          Unsubscribe from announce?
        </h3>
        <p className="text-sm text-zinc-400 mb-4">
          <span className="font-mono text-zinc-200">{email}</span> will stop
          receiving promotional emails about every future event — announcements,
          &ldquo;tickets available&rdquo; notices, and general blasts.
          They&rsquo;ll still get confirmations and reminders for any events
          they&rsquo;ve already got tickets to.
        </p>
        <Input
          type="text"
          aria-label="Reason"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mb-4"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(reason)}
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Unsubscribe"}
          </Button>
        </div>
      </div>
    </div>
  );
}
