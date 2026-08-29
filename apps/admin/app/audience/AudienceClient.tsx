"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDownIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
} from "@heroicons/react/16/solid";
import BulkSendProgress from "@/app/components/BulkSendProgress";
import { useConfirmationDialog } from "@/app/components/ConfirmationDialog";
import { useEventContext } from "@/app/EventContext";
import { useEventScopedFetch } from "@/app/lib/useEventScopedFetch";
import { BulkSendProgressState, runChunkedSend } from "@/app/lib/bulkSend";
import { formatDate, formatDateShort } from "@/app/lib/formatting";
import { getAnalyticsCardGridStyle } from "@/app/lib/utils";
import {
  Button,
  Input,
  Label,
  PageHeader,
  StatusPill,
  type SemanticColor,
} from "@/app/components/ui";

type AudienceEventSummary = {
  id: string;
  name: string | null;
  route: string | null;
  date: string | null;
};

type Affiliation =
  | "student"
  | "faculty"
  | "affiliate"
  | "staff"
  | "member"
  | "missing";

const EVENT_STATUS_OPTIONS = [
  { value: "notify", label: "Notify" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "ticketed", label: "Ticketed" },
  { value: "attended", label: "Attended" },
  { value: "none", label: "No current status" },
] as const;

type EventStatusOption = (typeof EVENT_STATUS_OPTIONS)[number]["value"];
const EVENT_STATUS_VALUES = EVENT_STATUS_OPTIONS.map((option) => option.value);

const ACTIVITY_OPTIONS = [
  { value: "with_history", label: "With event history" },
  { value: "without_history", label: "No event history" },
] as const;

type ActivityOption = (typeof ACTIVITY_OPTIONS)[number]["value"];
const ACTIVITY_VALUES = ACTIVITY_OPTIONS.map((option) => option.value);

type AudienceUser = {
  email: string;
  displayName: string | null;
  affiliation: Affiliation;
  lastLoginAt: string | null;
  currentEventStatus: {
    onNotifyList: boolean;
    waitlisted: boolean;
    ticketed: boolean;
    attended: boolean;
  };
  counts: {
    notified: number;
    waitlisted: number;
    ticketed: number;
    attended: number;
    totalHistoryEvents: number;
  };
};

type AudienceResponse = {
  event: AudienceEventSummary;
  users: AudienceUser[];
  stats: {
    totalUsers: number;
    currentEventNotifyUsers: number;
    currentEventEngagedUsers: number;
    usersWithAnyEventActivity: number;
    affiliationCounts: Record<Affiliation, number>;
  };
  warnings: string[];
};

type AudienceUserDetails = {
  notifyEvents: AudienceEventSummary[];
  waitlistEvents: AudienceEventSummary[];
  ticketedEvents: AudienceEventSummary[];
  attendedEvents: AudienceEventSummary[];
};

type FilterDropdownKey = "status" | "affiliation" | "history";
type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

const USER_PAGE_SIZE = 50;
const AFFILIATION_ORDER: Affiliation[] = [
  "student",
  "faculty",
  "affiliate",
  "staff",
  "member",
  "missing",
];

function getInitials(user: AudienceUser): string {
  const source = user.displayName || user.email;
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatAffiliationLabel(affiliation: Affiliation): string {
  if (affiliation === "missing") return "Missing";
  return affiliation.charAt(0).toUpperCase() + affiliation.slice(1);
}

function affiliationColor(affiliation: Affiliation): SemanticColor {
  switch (affiliation) {
    case "student":
      return "blue";
    case "faculty":
      return "violet";
    case "affiliate":
      return "sky";
    case "staff":
      return "emerald";
    case "member":
      return "amber";
    case "missing":
      return "zinc";
  }
}

function toggleSelection<T extends string>(
  selected: T[],
  value: T,
  orderedOptions: readonly T[],
): T[] {
  const next = new Set(selected);

  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }

  return orderedOptions.filter((option) => next.has(option));
}

function AffiliationPill({ affiliation }: { affiliation: Affiliation }) {
  return (
    <StatusPill color={affiliationColor(affiliation)}>
      {formatAffiliationLabel(affiliation)}
    </StatusPill>
  );
}

function summarizeSelection(
  options: readonly FilterOption[],
  selectedValues: readonly string[],
  allLabel: string,
  noneLabel: string,
): string {
  if (selectedValues.length === options.length) return allLabel;
  if (selectedValues.length === 0) return noneLabel;

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  if (selectedLabels.length <= 2) {
    return selectedLabels.join(", ");
  }

  return `${selectedLabels.length} selected`;
}

function FilterDropdown({
  title,
  summary,
  isOpen,
  options,
  selectedValues,
  onToggle,
  onToggleValue,
  onSelectAll,
  onClear,
}: {
  title: string;
  summary: string;
  isOpen: boolean;
  options: readonly FilterOption[];
  selectedValues: readonly string[];
  onToggle: () => void;
  onToggleValue: (value: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <FunnelIcon aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
        <span>{title}</span>
        <span className="max-w-40 truncate text-zinc-400">{summary}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className={`ml-auto size-4 shrink-0 text-zinc-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur">
          <div className="mb-3 px-1">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-zinc-500">
              Choose one or more options to include
            </p>
          </div>
          <div className="mb-3 flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {options.map((option) => {
              const checked = selectedValues.includes(option.value);

              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors ring-1 ring-inset ${
                    checked
                      ? "bg-rose-500/10 text-white ring-rose-500/25"
                      : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleValue(option.value)}
                      className="size-5 shrink-0 rounded accent-rose-500 sm:size-4"
                    />
                    <span>{option.label}</span>
                  </span>
                  {option.count != null && (
                    <span className="text-xs tabular-nums text-zinc-500">
                      {option.count}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EventBadge({
  event,
  tone,
}: {
  event: AudienceEventSummary;
  tone: "amber" | "blue" | "emerald" | "violet";
}) {
  const toneClasses = {
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
    blue: "bg-blue-500/10 text-blue-300 ring-blue-500/25",
    emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
    violet: "bg-violet-500/10 text-violet-300 ring-violet-500/25",
  };

  return (
    <div
      className={`rounded-lg px-3 py-2 text-xs ring-1 ring-inset ${toneClasses[tone]}`}
      title={event.name || "Unnamed event"}
    >
      <p className="font-medium truncate">{event.name || "Unnamed event"}</p>
      <p className="mt-1 text-[11px] opacity-80">
        {formatDateShort(event.date)}
      </p>
    </div>
  );
}

function getCurrentEventStatus(user: AudienceUser): {
  label: "Notify" | "Waitlisted" | "Ticketed" | "Attended" | "None";
  color: SemanticColor;
} {
  if (user.currentEventStatus.attended) {
    return { label: "Attended", color: "emerald" };
  }

  if (user.currentEventStatus.ticketed) {
    return { label: "Ticketed", color: "blue" };
  }

  if (user.currentEventStatus.waitlisted) {
    return { label: "Waitlisted", color: "violet" };
  }

  if (user.currentEventStatus.onNotifyList) {
    return { label: "Notify", color: "amber" };
  }

  return { label: "None", color: "zinc" };
}

function hasNoCurrentEventStatus(user: AudienceUser): boolean {
  return (
    !user.currentEventStatus.onNotifyList &&
    !user.currentEventStatus.waitlisted &&
    !user.currentEventStatus.ticketed &&
    !user.currentEventStatus.attended
  );
}

export default function AudienceClient() {
  const { selectedEventId } = useEventContext();
  const { confirm: confirmAction, confirmationDialog } =
    useConfirmationDialog();
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const { data, isLoading, error } = useEventScopedFetch<AudienceResponse>(
    selectedEventId,
    async (id, signal) => {
      const response = await fetch(`/api/events/${id}/audience`, { signal });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch audience data");
      }
      return (await response.json()) as AudienceResponse;
    },
  );
  const [detailsByEmail, setDetailsByEmail] = useState<
    Record<string, AudienceUserDetails>
  >({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [loadingDetailEmail, setLoadingDetailEmail] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] =
    useState<EventStatusOption[]>(EVENT_STATUS_VALUES);
  const [selectedAffiliations, setSelectedAffiliations] =
    useState<Affiliation[]>(AFFILIATION_ORDER);
  const [selectedActivity, setSelectedActivity] =
    useState<ActivityOption[]>(ACTIVITY_VALUES);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSendModal, setShowSendModal] = useState(false);
  const [includeNotifyListUsers, setIncludeNotifyListUsers] = useState(false);
  const [sendState, setSendState] = useState<BulkSendProgressState | null>(
    null,
  );
  const [individualSending, setIndividualSending] = useState<string | null>(
    null,
  );
  const [openFilterDropdown, setOpenFilterDropdown] =
    useState<FilterDropdownKey | null>(null);

  function resetFilters() {
    setSearch("");
    setSelectedStatuses(EVENT_STATUS_VALUES);
    setSelectedAffiliations(AFFILIATION_ORDER);
    setSelectedActivity(ACTIVITY_VALUES);
  }

  // Reset per-user detail lookups whenever the selected event changes.
  useEffect(() => {
    setDetailsByEmail({});
    setDetailErrors({});
    setExpandedEmail(null);
  }, [selectedEventId]);

  async function loadUserDetails(email: string) {
    if (!selectedEventId) return;
    if (detailsByEmail[email] || loadingDetailEmail === email) return;

    setLoadingDetailEmail(email);
    setDetailErrors((prev) => {
      if (!prev[email]) return prev;
      const next = { ...prev };
      delete next[email];
      return next;
    });

    try {
      const params = new URLSearchParams({ email });
      const response = await fetch(
        `/api/events/${selectedEventId}/audience/user?${params.toString()}`,
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch user history");
      }

      const detailData = (await response.json()) as AudienceUserDetails;
      setDetailsByEmail((prev) => ({ ...prev, [email]: detailData }));
    } catch (err) {
      console.error("Error fetching audience user details:", err);
      setDetailErrors((prev) => ({
        ...prev,
        [email]:
          err instanceof Error ? err.message : "Failed to fetch user history",
      }));
    } finally {
      setLoadingDetailEmail((current) => (current === email ? null : current));
    }
  }

  const filteredUsers = useMemo(() => {
    if (!data) return [];

    let list = data.users;

    if (selectedStatuses.length !== EVENT_STATUS_VALUES.length) {
      const selectedStatusSet = new Set(selectedStatuses);
      list = list.filter((user) => {
        const matchesNoStatus = hasNoCurrentEventStatus(user);

        return (
          (selectedStatusSet.has("notify") &&
            user.currentEventStatus.onNotifyList) ||
          (selectedStatusSet.has("waitlisted") &&
            user.currentEventStatus.waitlisted) ||
          (selectedStatusSet.has("ticketed") &&
            user.currentEventStatus.ticketed) ||
          (selectedStatusSet.has("attended") &&
            user.currentEventStatus.attended) ||
          (selectedStatusSet.has("none") && matchesNoStatus)
        );
      });
    }

    if (selectedAffiliations.length !== AFFILIATION_ORDER.length) {
      const selectedAffiliationSet = new Set(selectedAffiliations);
      list = list.filter((user) =>
        selectedAffiliationSet.has(user.affiliation),
      );
    }

    if (selectedActivity.length !== ACTIVITY_VALUES.length) {
      const selectedActivitySet = new Set(selectedActivity);
      list = list.filter((user) => {
        const hasHistory = user.counts.totalHistoryEvents > 0;
        return (
          (selectedActivitySet.has("with_history") && hasHistory) ||
          (selectedActivitySet.has("without_history") && !hasHistory)
        );
      });
    }

    const tokens = search
      .toLowerCase()
      .split(/[\n,]+/g)
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length > 0) {
      list = list.filter((user) => {
        const haystacks = [
          user.email.toLowerCase(),
          user.displayName?.toLowerCase() ?? "",
        ];

        return tokens.some((token) =>
          haystacks.some((haystack) => haystack.includes(token)),
        );
      });
    }

    return list;
  }, [data, search, selectedActivity, selectedAffiliations, selectedStatuses]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    selectedStatuses.length !== EVENT_STATUS_VALUES.length ||
    selectedAffiliations.length !== AFFILIATION_ORDER.length ||
    selectedActivity.length !== ACTIVITY_VALUES.length;

  const statusFilterOptions = useMemo<FilterOption[]>(() => {
    if (!data) {
      return EVENT_STATUS_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      }));
    }

    const noneCount = data.users.filter(hasNoCurrentEventStatus).length;

    return EVENT_STATUS_OPTIONS.map((option) => {
      switch (option.value) {
        case "notify":
          return {
            value: option.value,
            label: option.label,
            count: data.users.filter(
              (user) => user.currentEventStatus.onNotifyList,
            ).length,
          };
        case "waitlisted":
          return {
            value: option.value,
            label: option.label,
            count: data.users.filter(
              (user) => user.currentEventStatus.waitlisted,
            ).length,
          };
        case "ticketed":
          return {
            value: option.value,
            label: option.label,
            count: data.users.filter((user) => user.currentEventStatus.ticketed)
              .length,
          };
        case "attended":
          return {
            value: option.value,
            label: option.label,
            count: data.users.filter((user) => user.currentEventStatus.attended)
              .length,
          };
        default:
          return {
            value: option.value,
            label: option.label,
            count: noneCount,
          };
      }
    });
  }, [data]);

  const affiliationFilterOptions = useMemo<FilterOption[]>(() => {
    if (!data) {
      return AFFILIATION_ORDER.map((affiliation) => ({
        value: affiliation,
        label: formatAffiliationLabel(affiliation),
      }));
    }

    return AFFILIATION_ORDER.map((affiliation) => ({
      value: affiliation,
      label: formatAffiliationLabel(affiliation),
      count: data.stats.affiliationCounts[affiliation],
    }));
  }, [data]);

  const historyFilterOptions = useMemo<FilterOption[]>(() => {
    if (!data) {
      return ACTIVITY_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      }));
    }

    const withHistoryCount = data.users.filter(
      (user) => user.counts.totalHistoryEvents > 0,
    ).length;

    return [
      {
        value: "with_history",
        label: "With event history",
        count: withHistoryCount,
      },
      {
        value: "without_history",
        label: "No event history",
        count: data.users.length - withHistoryCount,
      },
    ];
  }, [data]);

  const statusFilterSummary = summarizeSelection(
    statusFilterOptions,
    selectedStatuses,
    "All statuses",
    "No statuses",
  );
  const affiliationFilterSummary = summarizeSelection(
    affiliationFilterOptions,
    selectedAffiliations,
    "All affiliations",
    "No affiliations",
  );
  const historyFilterSummary = summarizeSelection(
    historyFilterOptions,
    selectedActivity,
    "All history",
    "No history",
  );

  const nonNotifyEmails = useMemo(() => {
    if (!data) return [];
    return [
      ...new Set(
        data.users
          .filter((u) => !u.currentEventStatus.onNotifyList)
          .map((u) => u.email.toLowerCase()),
      ),
    ];
  }, [data]);

  const allAudienceEmails = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.users.map((user) => user.email.toLowerCase()))];
  }, [data]);

  const notifyAudienceEmails = useMemo(() => {
    if (!data) return [];
    return [
      ...new Set(
        data.users
          .filter((user) => user.currentEventStatus.onNotifyList)
          .map((user) => user.email.toLowerCase()),
      ),
    ];
  }, [data]);

  const announcementRecipients = useMemo(
    () => (includeNotifyListUsers ? allAudienceEmails : nonNotifyEmails),
    [allAudienceEmails, includeNotifyListUsers, nonNotifyEmails],
  );

  const CHUNK_SIZE = 50;

  async function sendAnnouncementToAll() {
    if (!selectedEventId || announcementRecipients.length === 0) return;
    setShowSendModal(false);
    setIncludeNotifyListUsers(false);
    await runChunkedSend({
      items: announcementRecipients,
      chunkSize: CHUNK_SIZE,
      label: "Sending announcements",
      onProgress: setSendState,
      sendChunk: async (chunk, context) => {
        const res = await fetch("/api/email/bulk-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedEventId,
            emails: chunk,
            auditBatchId: context.batchId,
            kind: "announcement",
          }),
        });
        const result = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            result?.error || "Failed to send announcement emails",
          );
        }

        return result;
      },
    });
  }

  async function sendAnnouncementToOne(email: string) {
    if (!selectedEventId) return;
    const shouldSend = await confirmAction({
      title: "Send announcement email?",
      description: (
        <>
          Send the current announcement for{" "}
          <span className="font-medium text-white">
            {data?.event.name || "this event"}
          </span>{" "}
          to <span className="font-medium text-white">{email}</span>.
        </>
      ),
      confirmLabel: "Send email",
      tone: "primary",
    });
    if (!shouldSend) return;

    setIndividualSending(email);
    try {
      const res = await fetch("/api/email/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          emails: [email],
          kind: "announcement",
        }),
      });
      const result = await res.json();
      if (result.sent === 1) {
        setIndividualSending(null);
      } else {
        setIndividualSending(null);
      }
    } catch {
      setIndividualSending(null);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
    setExpandedEmail(null);
  }, [
    search,
    selectedActivity,
    selectedAffiliations,
    selectedEventId,
    selectedStatuses,
  ]);

  useEffect(() => {
    setSendState(null);
    setIncludeNotifyListUsers(false);
  }, [selectedEventId]);

  useEffect(() => {
    setOpenFilterDropdown(null);
  }, [selectedEventId]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!filterDropdownRef.current?.contains(event.target as Node)) {
        setOpenFilterDropdown(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenFilterDropdown(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setExpandedEmail(null);
  }, [currentPage]);

  if (!selectedEventId) {
    return (
      <div className="px-4 sm:px-6 py-8 space-y-8">
        <PageHeader title="Event audience" />
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm font-medium text-zinc-300">
            Select an event to continue
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            The audience view follows the event selected in the sidebar.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 py-8 space-y-8">
        <PageHeader title="Event audience" />
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-zinc-400">
            <div className="size-5 rounded-full border-2 border-zinc-600 border-t-zinc-400 animate-spin" />
            <span className="text-sm">Loading audience data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 py-8 space-y-8">
        <PageHeader title="Event audience" />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <ExclamationTriangleIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-rose-400 mx-auto mb-2"
            />
            <p className="text-rose-400 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / USER_PAGE_SIZE),
  );
  const clampedPage = Math.min(currentPage, totalPages);
  const pageStart = (clampedPage - 1) * USER_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + USER_PAGE_SIZE, filteredUsers.length);
  const paginatedUsers = filteredUsers.slice(pageStart, pageEnd);
  const visiblePageNumbers = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  ).filter(
    (page) =>
      page === 1 || page === totalPages || Math.abs(page - clampedPage) <= 1,
  );
  const usersWithoutHistory =
    data.stats.totalUsers - data.stats.usersWithAnyEventActivity;

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        title="Event audience"
        subtitle={
          <>
            Known people and their event history for{" "}
            <span className="text-zinc-200 font-medium">
              {data.event.name || "Unnamed event"}
            </span>
            {data.event.date ? ` · ${formatDate(data.event.date)}` : ""}
          </>
        }
      >
        {allAudienceEmails.length > 0 && (
          <Button
            variant="primary"
            onClick={() => {
              setIncludeNotifyListUsers(false);
              setShowSendModal(true);
            }}
            disabled={sendState?.active}
            className="inline-flex items-center gap-2"
          >
            <EnvelopeIcon aria-hidden="true" className="size-4 shrink-0" />
            Send announcement
          </Button>
        )}
      </PageHeader>

      {/* Progress bar */}
      {sendState && (
        <BulkSendProgress
          state={sendState}
          onDismiss={() => setSendState(null)}
        />
      )}

      {/* Send Announcement Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-lg font-serif font-semibold text-white mb-2">
              Send announcement
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              Send an announcement email to{" "}
              <span className="text-white font-semibold">
                {announcementRecipients.length.toLocaleString()}
              </span>{" "}
              users for{" "}
              <span className="text-white font-medium">
                {data.event.name || "this event"}
              </span>
              .
            </p>
            <label
              className={`mb-4 flex cursor-pointer items-start gap-3 rounded-lg px-4 py-3 transition-colors ring-1 ring-inset ${
                includeNotifyListUsers
                  ? "bg-rose-500/10 ring-rose-500/25"
                  : "bg-white/5 ring-white/10 hover:bg-white/10"
              }`}
            >
              <input
                type="checkbox"
                checked={includeNotifyListUsers}
                onChange={(event) =>
                  setIncludeNotifyListUsers(event.target.checked)
                }
                className="mt-0.5 size-5 shrink-0 rounded accent-rose-500 sm:size-4"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-white">
                  Include users already on the notify list
                </span>
                <span className="block text-xs text-zinc-400">
                  {includeNotifyListUsers
                    ? `This will send to all ${allAudienceEmails.length.toLocaleString()} audience members, including ${notifyAudienceEmails.length.toLocaleString()} already on notify.`
                    : `This will send only to the ${nonNotifyEmails.length.toLocaleString()} users who are not already on the notify list.`}
                </span>
              </span>
            </label>
            {announcementRecipients.length === 0 && (
              <div className="rounded-lg bg-amber-500/10 p-3 mb-4 ring-1 ring-inset ring-amber-500/25">
                <p className="text-xs text-amber-300">
                  Everyone in this audience is already on the notify list. Turn
                  on the toggle above to send the announcement to all of them.
                </p>
              </div>
            )}
            {announcementRecipients.length > 500 && (
              <div className="rounded-lg bg-amber-500/10 p-3 mb-4 ring-1 ring-inset ring-amber-500/25">
                <p className="text-xs text-amber-300">
                  Large batch — this will send in chunks of {CHUNK_SIZE} and may
                  take a few minutes.
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowSendModal(false);
                  setIncludeNotifyListUsers(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={sendAnnouncementToAll}
                disabled={announcementRecipients.length === 0}
              >
                Send {announcementRecipients.length.toLocaleString()} emails
              </Button>
            </div>
          </div>
        </div>
      )}

      {data.warnings.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 p-4 ring-1 ring-inset ring-amber-500/25">
          <p className="text-sm text-amber-300">{data.warnings[0]}</p>
        </div>
      )}

      <div
        className="grid grid-cols-2 gap-3 analytics-card-grid"
        style={getAnalyticsCardGridStyle(4)}
      >
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-400 mb-1">
            Total users
          </p>
          <p className="text-2xl font-bold tabular-nums text-white">
            {data.stats.totalUsers}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-400 mb-1">
            Current event engaged
          </p>
          <p className="text-2xl font-bold tabular-nums text-blue-400">
            {data.stats.currentEventEngagedUsers}
          </p>
          <p className="text-[10px] text-zinc-600">
            Notify, waitlisted, ticketed, or attended
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-400 mb-1">
            Signed up for notify
          </p>
          <p className="text-2xl font-bold tabular-nums text-amber-400">
            {data.stats.currentEventNotifyUsers}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-400 mb-1">
            No event history
          </p>
          <p className="text-2xl font-bold tabular-nums text-zinc-300">
            {usersWithoutHistory}
          </p>
          <p className="text-[10px] text-zinc-600">
            No notify, waitlist, or ticket activity on file
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Affiliation breakdown
            </h3>
            <p className="text-xs text-zinc-500">
              Breakdown across the current audience
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {AFFILIATION_ORDER.map((affiliation) => {
            return (
              <div
                key={affiliation}
                className="rounded-lg bg-white/5 p-4 text-left ring-1 ring-inset ring-white/10"
              >
                <p className="text-xs font-medium tracking-wide text-zinc-400 mb-1">
                  {formatAffiliationLabel(affiliation)}
                </p>
                <p className="text-2xl font-bold tabular-nums text-white">
                  {data.stats.affiliationCounts[affiliation]}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={filterDropdownRef}
        className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Filters</h3>
            <p className="text-xs text-zinc-500">
              Use dropdowns with checkboxes to narrow the audience
            </p>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={resetFilters} className="text-xs">
              Reset filters
            </Button>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="audience-search" className="mb-2 block">
              Search users
            </Label>
            <Input
              id="audience-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email. Comma-separated works too."
            />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[repeat(3,minmax(0,240px))] gap-4">
            <FilterDropdown
              title="Current Event"
              summary={statusFilterSummary}
              isOpen={openFilterDropdown === "status"}
              options={statusFilterOptions}
              selectedValues={selectedStatuses}
              onToggle={() =>
                setOpenFilterDropdown((current) =>
                  current === "status" ? null : "status",
                )
              }
              onToggleValue={(value) =>
                setSelectedStatuses((current) =>
                  toggleSelection(
                    current,
                    value as EventStatusOption,
                    EVENT_STATUS_VALUES,
                  ),
                )
              }
              onSelectAll={() => setSelectedStatuses(EVENT_STATUS_VALUES)}
              onClear={() => setSelectedStatuses([])}
            />
            <FilterDropdown
              title="Affiliation"
              summary={affiliationFilterSummary}
              isOpen={openFilterDropdown === "affiliation"}
              options={affiliationFilterOptions}
              selectedValues={selectedAffiliations}
              onToggle={() =>
                setOpenFilterDropdown((current) =>
                  current === "affiliation" ? null : "affiliation",
                )
              }
              onToggleValue={(value) =>
                setSelectedAffiliations((current) =>
                  toggleSelection(
                    current,
                    value as Affiliation,
                    AFFILIATION_ORDER,
                  ),
                )
              }
              onSelectAll={() => setSelectedAffiliations(AFFILIATION_ORDER)}
              onClear={() => setSelectedAffiliations([])}
            />
            <FilterDropdown
              title="History"
              summary={historyFilterSummary}
              isOpen={openFilterDropdown === "history"}
              options={historyFilterOptions}
              selectedValues={selectedActivity}
              onToggle={() =>
                setOpenFilterDropdown((current) =>
                  current === "history" ? null : "history",
                )
              }
              onToggleValue={(value) =>
                setSelectedActivity((current) =>
                  toggleSelection(
                    current,
                    value as ActivityOption,
                    ACTIVITY_VALUES,
                  ),
                )
              }
              onSelectAll={() => setSelectedActivity(ACTIVITY_VALUES)}
              onClear={() => setSelectedActivity([])}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium tracking-wide text-zinc-400 whitespace-nowrap">
                  User
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium tracking-wide text-zinc-400 whitespace-nowrap">
                  Affiliation
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium tracking-wide text-zinc-400 whitespace-nowrap">
                  Last login
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium tracking-wide text-zinc-400 whitespace-nowrap">
                  This event
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium tracking-wide text-zinc-400 whitespace-nowrap">
                  History
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {paginatedUsers.map((user) => {
                const isExpanded = expandedEmail === user.email;
                const userDetails = detailsByEmail[user.email];
                const detailError = detailErrors[user.email];
                const isLoadingDetails = loadingDetailEmail === user.email;
                const currentEventStatus = getCurrentEventStatus(user);

                return (
                  <tr key={user.email}>
                    <td
                      className="px-4 py-3"
                      colSpan={isExpanded ? 5 : undefined}
                    >
                      <button
                        onClick={() => {
                          const nextExpanded = isExpanded ? null : user.email;
                          setExpandedEmail(nextExpanded);
                          if (nextExpanded) {
                            void loadUserDetails(user.email);
                          }
                        }}
                        className="flex w-full items-start gap-3 text-left"
                      >
                        <div className="size-10 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-zinc-300 shrink-0">
                          {getInitials(user)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <p className="text-white font-medium truncate">
                              {user.displayName || "No name on file"}
                            </p>
                            <AffiliationPill affiliation={user.affiliation} />
                          </div>
                          <p className="text-xs text-zinc-500 truncate">
                            {user.email}
                          </p>

                          {isExpanded && (
                            <div className="mt-4 space-y-4">
                              {isLoadingDetails && !userDetails ? (
                                <div className="rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                                  <div className="flex items-center gap-3 text-zinc-400">
                                    <div className="size-4 rounded-full border-2 border-zinc-600 border-t-zinc-400 animate-spin" />
                                    <span className="text-sm">
                                      Loading event history...
                                    </span>
                                  </div>
                                </div>
                              ) : detailError ? (
                                <div className="rounded-lg bg-rose-500/10 p-4 ring-1 ring-inset ring-rose-500/25">
                                  <p className="text-sm text-rose-300">
                                    {detailError}
                                  </p>
                                </div>
                              ) : userDetails ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                                  <div className="rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                                    <p className="text-xs font-medium tracking-wide text-zinc-400 mb-2">
                                      Notified
                                    </p>
                                    {userDetails.notifyEvents.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {userDetails.notifyEvents.map(
                                          (event) => (
                                            <EventBadge
                                              key={`notify-${event.id}`}
                                              event={event}
                                              tone="amber"
                                            />
                                          ),
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-zinc-500">
                                        No notify signups yet.
                                      </p>
                                    )}
                                  </div>
                                  <div className="rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                                    <p className="text-xs font-medium tracking-wide text-zinc-400 mb-2">
                                      Waitlisted
                                    </p>
                                    {userDetails.waitlistEvents.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {userDetails.waitlistEvents.map(
                                          (event) => (
                                            <EventBadge
                                              key={`waitlist-${event.id}`}
                                              event={event}
                                              tone="violet"
                                            />
                                          ),
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-zinc-500">
                                        No waitlist history yet.
                                      </p>
                                    )}
                                  </div>
                                  <div className="rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                                    <p className="text-xs font-medium tracking-wide text-zinc-400 mb-2">
                                      Ticketed
                                    </p>
                                    {userDetails.ticketedEvents.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {userDetails.ticketedEvents.map(
                                          (event) => (
                                            <EventBadge
                                              key={`ticketed-${event.id}`}
                                              event={event}
                                              tone="blue"
                                            />
                                          ),
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-zinc-500">
                                        No ticket history yet.
                                      </p>
                                    )}
                                  </div>
                                  <div className="rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                                    <p className="text-xs font-medium tracking-wide text-zinc-400 mb-2">
                                      Attended
                                    </p>
                                    {userDetails.attendedEvents.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {userDetails.attendedEvents.map(
                                          (event) => (
                                            <EventBadge
                                              key={`attended-${event.id}`}
                                              event={event}
                                              tone="emerald"
                                            />
                                          ),
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-zinc-500">
                                        No attendance recorded yet.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </button>
                    </td>
                    {!isExpanded && (
                      <>
                        <td className="px-3 py-3">
                          <AffiliationPill affiliation={user.affiliation} />
                        </td>
                        <td className="px-3 py-3 text-xs text-zinc-400 whitespace-nowrap">
                          {user.lastLoginAt
                            ? formatDate(user.lastLoginAt)
                            : "Unknown"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <StatusPill color={currentEventStatus.color}>
                              {currentEventStatus.label}
                            </StatusPill>
                            {(hasNoCurrentEventStatus(user) ||
                              user.currentEventStatus.onNotifyList) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendAnnouncementToOne(user.email);
                                }}
                                disabled={
                                  individualSending === user.email ||
                                  sendState?.active
                                }
                                title="Send announcement email"
                                className="p-1 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {individualSending === user.email ? (
                                  <div className="size-3.5 rounded-full border-2 border-zinc-600 border-t-zinc-400 animate-spin" />
                                ) : (
                                  <EnvelopeIcon aria-hidden="true" className="size-4 shrink-0" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-semibold tabular-nums text-white">
                              {user.counts.totalHistoryEvents}
                            </span>
                            <span className="text-[11px] tabular-nums text-zinc-500">
                              {user.counts.notified} N /{" "}
                              {user.counts.waitlisted} W /{" "}
                              {user.counts.ticketed} T / {user.counts.attended}{" "}
                              A
                            </span>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length > 0 && (
          <div className="px-4 py-3 border-t border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs tabular-nums text-zinc-500">
              Showing {pageStart + 1}-{pageEnd} of {filteredUsers.length} users
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(page - 1, 1))
                  }
                  disabled={clampedPage === 1}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 text-zinc-300 text-xs font-medium ring-1 ring-inset ring-white/10 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                >
                  Prev
                </button>
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
                        className={`min-w-8 px-2.5 py-1.5 rounded-lg text-xs font-medium tabular-nums ring-1 ring-inset transition-colors ${
                          clampedPage === page
                            ? "bg-rose-500/15 text-rose-300 ring-rose-500/25"
                            : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                        }`}
                      >
                        {page}
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(page + 1, totalPages))
                  }
                  disabled={clampedPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 text-zinc-300 text-xs font-medium ring-1 ring-inset ring-white/10 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {filteredUsers.length === 0 && (
          <div className="px-4 py-8 text-center text-zinc-500 text-sm">
            No users match your filters
          </div>
        )}
      </div>
      {confirmationDialog}
    </div>
  );
}
