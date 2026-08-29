"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ArrowDownTrayIcon,
  InformationCircleIcon,
  UsersIcon,
} from "@heroicons/react/16/solid";
import { getAnalyticsCardGridStyle } from "@/app/lib/utils";
import { formatDateShort as formatDate } from "@/app/lib/formatting";
import {
  Button,
  Input,
  Label,
  Select,
  Tabs,
  Tab,
  PageHeader,
  Table,
  TableScroll,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/app/components/ui";

// ── Types ────────────────────────────────────────────────────────────────

type AttendeeEvent = {
  eventId: string;
  eventName: string | null;
  eventDate: string | null;
  attended: boolean;
};

type Attendee = {
  email: string;
  name: string | null;
  eventsRegistered: number;
  eventsAttended: number;
  attendanceRate: number;
  currentStreak: number;
  firstSeen: string | null;
  lastSeen: string | null;
  events: AttendeeEvent[];
};

type EventSummary = {
  id: string;
  name: string | null;
  date: string | null;
  capacity: number;
  totalTickets: number;
  scannedCount: number;
};

type Stats = {
  totalUniqueAttendees: number;
  averageAttendanceRate: number;
  perfectAttendanceCount: number;
  zeroAttendanceCount: number;
  averageEventsPerPerson: number;
  repeatRate: number;
};

type AttendanceResponse = {
  attendees: Attendee[];
  events: EventSummary[];
  stats: Stats;
};

type FilterTab = "all" | "loyalists" | "flakers" | "mixed";
type SegmentedAttendees = Record<FilterTab, Attendee[]>;

// ── Helpers ──────────────────────────────────────────────────────────────

const FILTER_TAB_LABELS: Record<FilterTab, string> = {
  all: "All",
  loyalists: "Loyalists",
  flakers: "Flakers",
  mixed: "Mixed",
};

const FILTER_TABS = (
  Object.entries(FILTER_TAB_LABELS) as Array<[FilterTab, string]>
).map(([key, label]) => ({ key, label }));

const EMPTY_SEGMENTS: SegmentedAttendees = {
  all: [],
  loyalists: [],
  flakers: [],
  mixed: [],
};

function matchesFilterTab(
  attendee: Attendee,
  filterTab: FilterTab,
  minEvents: number,
): boolean {
  if (attendee.eventsRegistered < minEvents) return false;
  if (filterTab === "loyalists") return attendee.attendanceRate >= 0.9;
  if (filterTab === "flakers") return attendee.attendanceRate <= 0.1;
  if (filterTab === "mixed")
    return attendee.attendanceRate > 0.1 && attendee.attendanceRate < 0.9;
  return true;
}

function getAttendeeSegment(attendee: Attendee): Exclude<FilterTab, "all"> {
  if (attendee.attendanceRate >= 0.9) return "loyalists";
  if (attendee.attendanceRate <= 0.1) return "flakers";
  return "mixed";
}

function escapeCsvValue(value: string | number): string {
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function ProgressBar({
  value,
  max,
  color = "#10b981",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function rateColor(rate: number): string {
  if (rate >= 0.9) return "text-emerald-400";
  if (rate >= 0.6) return "text-blue-400";
  if (rate >= 0.3) return "text-amber-400";
  return "text-rose-400";
}

function rateBgColor(rate: number): string {
  if (rate >= 0.9) return "#10b981";
  if (rate >= 0.6) return "#3b82f6";
  if (rate >= 0.3) return "#f59e0b";
  return "#f43f5e";
}

const ATTENDEE_PAGE_SIZE = 50;

// ── Main Component ───────────────────────────────────────────────────────

export default function AttendanceClient() {
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [minEvents, setMinEvents] = useState(2);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch("/api/attendance");
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch attendance data");
        }
        setData(await res.json());
      } catch (err) {
        console.error("Error fetching attendance:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Distribution histogram: attendance rate buckets (0-10%, 10-20%, ...)
  const histogram = useMemo(() => {
    if (!data) return [];
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      label: `${i * 10}-${(i + 1) * 10}%`,
      min: i * 0.1,
      max: (i + 1) * 0.1,
      count: 0,
    }));
    const multi = data.attendees.filter((a) => a.eventsRegistered >= minEvents);
    for (const a of multi) {
      const idx = Math.min(Math.floor(a.attendanceRate * 10), 9);
      buckets[idx].count++;
    }
    return buckets;
  }, [data, minEvents]);

  const maxBucket = useMemo(
    () => Math.max(...histogram.map((b) => b.count), 1),
    [histogram],
  );

  const attendeesByTab = useMemo<SegmentedAttendees>(() => {
    if (!data) return EMPTY_SEGMENTS;

    const all = data.attendees.filter((attendee) =>
      matchesFilterTab(attendee, "all", minEvents),
    );
    return {
      all,
      loyalists: all.filter((attendee) =>
        matchesFilterTab(attendee, "loyalists", minEvents),
      ),
      flakers: all.filter((attendee) =>
        matchesFilterTab(attendee, "flakers", minEvents),
      ),
      mixed: all.filter((attendee) =>
        matchesFilterTab(attendee, "mixed", minEvents),
      ),
    };
  }, [data, minEvents]);

  // Filtered & searched attendees
  const filteredAttendees = useMemo(() => {
    let list = attendeesByTab[filterTab];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.email.toLowerCase().includes(q) ||
          (a.name && a.name.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [attendeesByTab, filterTab, search]);

  // Per-event new vs returning
  const eventRetention = useMemo(() => {
    if (!data || data.events.length === 0) return [];
    // Build a set of emails seen before each event (chronological)
    const sorted = [...data.events].sort(
      (a, b) =>
        new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime(),
    );
    const seenEmails = new Set<string>();
    return sorted.map((ev) => {
      const attendees = data.attendees.filter((a) =>
        a.events.some((e) => e.eventId === ev.id),
      );
      let newCount = 0;
      let returningCount = 0;
      for (const a of attendees) {
        if (seenEmails.has(a.email.toLowerCase())) {
          returningCount++;
        } else {
          newCount++;
        }
        seenEmails.add(a.email.toLowerCase());
      }
      return {
        ...ev,
        newCount,
        returningCount,
        totalRegistered: attendees.length,
      };
    });
  }, [data]);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedEmail(null);
  }, [filterTab, search, minEvents, data?.attendees.length]);

  useEffect(() => {
    setExpandedEmail(null);
  }, [currentPage]);

  function exportAttendees(filter: FilterTab) {
    const attendees = attendeesByTab[filter];
    if (attendees.length === 0) return;

    const rows = [
      [
        "Segment",
        "Name",
        "Email",
        "Events Registered",
        "Events Attended",
        "Attendance Rate",
        "Current Streak",
        "First Seen",
        "Last Seen",
        "Event History",
      ],
      ...attendees.map((attendee) => [
        FILTER_TAB_LABELS[getAttendeeSegment(attendee)],
        attendee.name || "",
        attendee.email,
        attendee.eventsRegistered,
        attendee.eventsAttended,
        `${(attendee.attendanceRate * 100).toFixed(1)}%`,
        attendee.currentStreak,
        formatDate(attendee.firstSeen),
        formatDate(attendee.lastSeen),
        attendee.events
          .map((event) => {
            const eventDate = formatDate(event.eventDate);
            const eventLabel = event.eventName || "Unnamed";
            return `${eventLabel} (${eventDate}): ${event.attended ? "Attended" : "No-show"}`;
          })
          .join(" | "),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const segmentSlug = FILTER_TAB_LABELS[filter].toLowerCase();

    link.href = url;
    link.download = `attendance-${segmentSlug}-min-${minEvents}-events.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── Loading / Error states ──

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <PageHeader title="Attendance Overview" />
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-zinc-400">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
            <span className="text-sm">Loading attendance data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <PageHeader title="Attendance Overview" />
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="text-center">
            <InformationCircleIcon className="size-4 shrink-0 text-rose-400 mx-auto mb-2 w-10 h-10" aria-hidden="true" />
            <p className="text-rose-400 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.attendees.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <PageHeader title="Attendance Overview" />
        <div className="mt-8 text-center py-16 bg-zinc-900/60 rounded-2xl border border-white/10">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <UsersIcon className="size-4 shrink-0 text-zinc-600 w-8 h-8" aria-hidden="true" />
          </div>
          <p className="text-zinc-400 text-lg mb-2">No attendance data yet</p>
          <p className="text-zinc-600 text-sm">
            Attendance data appears after events have started
          </p>
        </div>
      </div>
    );
  }

  const { stats } = data;
  const multiEventCount = attendeesByTab.all.length;
  const loyalistCount = attendeesByTab.loyalists.length;
  const flakerCount = attendeesByTab.flakers.length;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAttendees.length / ATTENDEE_PAGE_SIZE),
  );
  const clampedPage = Math.min(currentPage, totalPages);
  const pageStart = (clampedPage - 1) * ATTENDEE_PAGE_SIZE;
  const pageEnd = Math.min(
    pageStart + ATTENDEE_PAGE_SIZE,
    filteredAttendees.length,
  );
  const paginatedAttendees = filteredAttendees.slice(pageStart, pageEnd);
  const visiblePageNumbers = Array.from(
    { length: totalPages },
    (_, i) => i + 1,
  ).filter(
    (page) =>
      page === 1 || page === totalPages || Math.abs(page - clampedPage) <= 1,
  );

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title="Attendance Overview"
          subtitle={`Cross-event attendee patterns across ${data.events.length} past events`}
        />
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 xl:min-w-[360px]">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownTrayIcon className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
            <p className="text-xs font-medium tracking-wide text-zinc-500">
              Export CSV
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => {
              const exportCount = attendeesByTab[tab.key].length;

              return (
                <Button
                  key={tab.key}
                  onClick={() => exportAttendees(tab.key)}
                  disabled={exportCount === 0}
                  className="inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>{tab.label}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] tabular-nums text-zinc-400">
                    {exportCount}
                  </span>
                </Button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-zinc-600">
            Exports follow the current minimum events setting.
          </p>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div
        className="grid grid-cols-2 gap-3 analytics-card-grid"
        style={getAnalyticsCardGridStyle(6)}
      >
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-500 mb-1">
            Unique attendees
          </p>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {stats.totalUniqueAttendees}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-500 mb-1">
            Avg attendance
          </p>
          <p className="text-2xl font-semibold tabular-nums text-blue-400">
            {(stats.averageAttendanceRate * 100).toFixed(0)}%
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-500 mb-1">
            Perfect record
          </p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-400">
            {stats.perfectAttendanceCount}
          </p>
          <p className="text-[10px] text-zinc-600">2+ events, 100% rate</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-500 mb-1">
            Serial flakers
          </p>
          <p className="text-2xl font-semibold tabular-nums text-rose-400">
            {stats.zeroAttendanceCount}
          </p>
          <p className="text-[10px] text-zinc-600">2+ events, 0% rate</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-500 mb-1">
            Avg events/person
          </p>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {stats.averageEventsPerPerson.toFixed(1)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-500 mb-1">
            Repeat rate
          </p>
          <p className="text-2xl font-semibold tabular-nums text-violet-400">
            {(stats.repeatRate * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-zinc-600">attended 2+ events</p>
        </div>
      </div>

      {/* ── Attendance Rate Distribution ── */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">
            Attendance rate distribution
          </h3>
          <p className="text-xs text-zinc-500">
            {multiEventCount} people with {minEvents}+ events
          </p>
        </div>
        <div className="flex items-end gap-1 h-32">
          {histogram.map((bucket, i) => {
            const heightPct =
              maxBucket > 0 ? (bucket.count / maxBucket) * 100 : 0;
            const barColor =
              i >= 9
                ? "#10b981"
                : i >= 6
                  ? "#3b82f6"
                  : i >= 3
                    ? "#f59e0b"
                    : "#f43f5e";
            return (
              <div
                key={bucket.label}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className="text-[10px] text-zinc-500">
                  {bucket.count}
                </span>
                <div
                  className="w-full flex items-end justify-center"
                  style={{ height: "80px" }}
                >
                  <div
                    className="w-full max-w-[40px] rounded-t transition-all duration-300"
                    style={{
                      height: `${Math.max(heightPct, bucket.count > 0 ? 4 : 0)}%`,
                      backgroundColor: barColor,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-[9px] text-zinc-600 whitespace-nowrap">
                  {i * 10}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Event-level new vs returning ── */}
      {eventRetention.length > 1 && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            New vs returning by event
          </h3>
          <div className="space-y-2">
            {eventRetention.map((ev) => {
              const total = ev.totalRegistered || 1;
              const retPct = (ev.returningCount / total) * 100;
              return (
                <div key={ev.id} className="flex items-center gap-3">
                  <span
                    className="text-xs text-zinc-400 w-32 truncate shrink-0"
                    title={ev.name ?? ""}
                  >
                    {ev.name || "Unnamed"}
                  </span>
                  <div className="flex-1 flex h-5 rounded overflow-hidden bg-zinc-800">
                    {ev.returningCount > 0 && (
                      <div
                        className="bg-blue-500 flex items-center justify-center text-[10px] text-white font-medium transition-all"
                        style={{ width: `${retPct}%` }}
                      >
                        {ev.returningCount > 3 ? ev.returningCount : ""}
                      </div>
                    )}
                    {ev.newCount > 0 && (
                      <div
                        className="bg-emerald-500 flex items-center justify-center text-[10px] text-white font-medium transition-all"
                        style={{ width: `${100 - retPct}%` }}
                      >
                        {ev.newCount > 3 ? ev.newCount : ""}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 w-12 text-right shrink-0">
                    {ev.totalRegistered}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-zinc-400">Returning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-400">New</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter tabs + search ── */}
      <div className="flex flex-col gap-3">
        <Tabs wrap>
          {FILTER_TABS.map((tab) => (
            <Tab
              key={tab.key}
              active={filterTab === tab.key}
              count={
                tab.key === "all"
                  ? multiEventCount
                  : tab.key === "loyalists"
                    ? loyalistCount
                    : tab.key === "flakers"
                      ? flakerCount
                      : attendeesByTab.mixed.length
              }
              onClick={() => setFilterTab(tab.key)}
            >
              {tab.label}
            </Tab>
          ))}
        </Tabs>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 max-w-xs"
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="min-events">Min events:</Label>
            <Select
              id="min-events"
              value={minEvents}
              onChange={(e) => setMinEvents(Number(e.target.value))}
            >
              <option value={1}>1+</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={5}>5+</option>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Attendee table ── */}
      <div>
        <TableScroll>
          <Table>
            <THead>
              <TR className="border-b border-white/10">
                <TH>Attendee</TH>
                <TH className="text-center">Events</TH>
                <TH className="text-center">Attended</TH>
                <TH className="text-center">Rate</TH>
                <TH className="text-center">Streak</TH>
                <TH className="hidden lg:table-cell">Last seen</TH>
              </TR>
            </THead>
            <TBody>
              {paginatedAttendees.map((a) => {
                const isExpanded = expandedEmail === a.email;
                return (
                  <TR key={a.email} className="group">
                    <TD colSpan={isExpanded ? 6 : undefined}>
                      {!isExpanded
                        ? null
                        : /* Expanded row content rendered in a single-cell block below */
                          null}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedEmail(isExpanded ? null : a.email)
                        }
                        className="flex items-center gap-3 text-left w-full"
                      >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-zinc-300 shrink-0">
                          {(a.name || a.email)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">
                            {a.name || "No name"}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">
                            {a.email}
                          </p>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="mt-3 ml-11 space-y-1.5">
                          {a.events.map((ev) => (
                            <div
                              key={ev.eventId}
                              className="flex items-center gap-2 text-xs"
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${ev.attended ? "bg-emerald-500" : "bg-rose-500"}`}
                              />
                              <span className="text-zinc-400 truncate">
                                {ev.eventName || "Unnamed"}
                              </span>
                              <span className="text-zinc-600">
                                {formatDate(ev.eventDate)}
                              </span>
                              <span
                                className={
                                  ev.attended
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                                }
                              >
                                {ev.attended ? "Attended" : "No-show"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </TD>
                    {!isExpanded && (
                      <>
                        <TD className="text-center text-zinc-300 tabular-nums">
                          {a.eventsRegistered}
                        </TD>
                        <TD className="text-center text-zinc-300 tabular-nums">
                          {a.eventsAttended}
                        </TD>
                        <TD>
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`font-semibold tabular-nums ${rateColor(a.attendanceRate)}`}
                            >
                              {(a.attendanceRate * 100).toFixed(0)}%
                            </span>
                            <div className="w-16">
                              <ProgressBar
                                value={a.eventsAttended}
                                max={a.eventsRegistered}
                                color={rateBgColor(a.attendanceRate)}
                              />
                            </div>
                          </div>
                        </TD>
                        <TD className="text-center">
                          {a.currentStreak > 0 ? (
                            <span className="text-emerald-400 font-medium tabular-nums">
                              {a.currentStreak}
                            </span>
                          ) : (
                            <span className="text-zinc-600">0</span>
                          )}
                        </TD>
                        <TD className="text-zinc-500 text-xs hidden lg:table-cell">
                          {formatDate(a.lastSeen)}
                        </TD>
                      </>
                    )}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableScroll>
        {filteredAttendees.length > 0 && (
          <div className="px-1 py-3 border-t border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500 tabular-nums">
              Showing {pageStart + 1}-{pageEnd} of {filteredAttendees.length}{" "}
              attendees
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                <Button
                  onClick={() =>
                    setCurrentPage((page) => Math.max(page - 1, 1))
                  }
                  disabled={clampedPage === 1}
                  className="px-2.5 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </Button>
                {visiblePageNumbers.map((page, index) => {
                  const previousPage = visiblePageNumbers[index - 1];
                  const needsGap =
                    previousPage != null && page - previousPage > 1;
                  return (
                    <div key={page} className="flex items-center gap-1.5">
                      {needsGap && (
                        <span className="px-1 text-xs text-zinc-600">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                          clampedPage === page
                            ? "bg-rose-500 text-white hover:bg-rose-400"
                            : "bg-white/5 text-zinc-300 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                        }`}
                      >
                        {page}
                      </button>
                    </div>
                  );
                })}
                <Button
                  onClick={() =>
                    setCurrentPage((page) => Math.min(page + 1, totalPages))
                  }
                  disabled={clampedPage === totalPages}
                  className="px-2.5 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
        {filteredAttendees.length === 0 && (
          <div className="px-4 py-8 text-center text-zinc-500 text-sm">
            No attendees match your filters
          </div>
        )}
      </div>
    </div>
  );
}
