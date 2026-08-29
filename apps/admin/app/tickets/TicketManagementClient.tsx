"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BulkSendProgress from "@/app/components/BulkSendProgress";
import {
  ConfirmationDialog,
  useConfirmationDialog,
} from "@/app/components/ConfirmationDialog";
import { useEventContext } from "@/app/EventContext";
import { REMINDER_EMAIL_BATCH_SIZE } from "@/app/lib/constants";
import { BulkSendProgressState, runChunkedSend } from "@/app/lib/bulkSend";
import { formatDate } from "@/app/lib/formatting";
import { isValidEmail } from "@/app/lib/validation";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BellIcon,
  CheckIcon,
  ClockIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  StatusPill,
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/app/components/ui";

export type Ticket = {
  id: string;
  email: string;
  name: string | null;
  title: string | null;
  type: string | null;
  created_at: string;
  scanned: boolean;
  scan_time: string | null;
  referral: string | null;
  has_fee_waiver: boolean;
  event_id: string;
  events: {
    id: string;
    name: string | null;
    route: string | null;
    start_time_date: string | null;
  } | null;
};

type TicketRow = { name: string; email: string; title: string };
type EmailLookupResult = { type: string; name: string | null } | null;

type ReminderRecipient = Pick<Ticket, "id" | "email">;

type TicketAffiliationKey =
  | "student"
  | "faculty"
  | "affiliate"
  | "staff"
  | "member"
  | "unknown";

type AffiliationCounts = Record<TicketAffiliationKey, number>;

type TicketManagementClientProps = {
  initialTickets: Ticket[];
  initialTotal: number;
  initialScannedCount: number;
  initialUnscannedCount: number;
  initialFeeWaiverCount: number;
  initialFilteredCount: number;
  initialStandardCount: number;
  initialVipCount: number;
  initialExternalCount: number;
  initialStandbyCount: number;
  initialAffiliationCounts: AffiliationCounts;
};

const AFFILIATION_FILTER_ORDER: TicketAffiliationKey[] = [
  "student",
  "faculty",
  "affiliate",
  "staff",
  "member",
  "unknown",
];

function createEmptyAffiliationCounts(): AffiliationCounts {
  return {
    student: 0,
    faculty: 0,
    affiliate: 0,
    staff: 0,
    member: 0,
    unknown: 0,
  };
}

function formatAffiliationLabel(affiliation: TicketAffiliationKey): string {
  if (affiliation === "unknown") return "Unknown";
  return affiliation.charAt(0).toUpperCase() + affiliation.slice(1);
}

// Parses the standard "Name" <email> format (e.g. from email clients), with or
// without surrounding quotes around the name. Returns null if the input doesn't
// match that shape so callers can fall back to treating it as plain text.
function parseNameEmailPair(
  value: string,
): Pick<TicketRow, "name" | "email"> | null {
  const match = value.match(/^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (!match) {
    return null;
  }
  const name = match[1].trim().replace(/^["']|["']$/g, "").trim();
  const email = match[2].trim();
  return { name, email };
}

function escapeCsvValue(value: string | number): string {
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseSpreadsheetTicketRows(clipboardText: string): TicketRow[] {
  const rows = clipboardText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  const parsedRows: TicketRow[] = [];

  for (const row of rows) {
    const columns = row.split("\t").map((column) => column.trim());
    const hasUnexpectedExtraColumns = columns.slice(2).some(Boolean);

    if (columns.length < 2 || hasUnexpectedExtraColumns) {
      return [];
    }

    parsedRows.push({
      name: columns[0] || "",
      email: columns[1] || "",
      title: "",
    });
  }

  return parsedRows;
}

const TICKET_TYPES = ["VIP", "STANDARD", "EXTERNAL", "STANDBY"] as const;

function typeBadgeClasses(type: string | null): string {
  switch (type) {
    case "VIP":
      return "bg-blue-500/15 text-blue-300 ring-blue-500/25";
    case "EXTERNAL":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
    case "STANDBY":
      return "bg-amber-500/15 text-amber-300 ring-amber-500/25";
    default:
      return "bg-white/5 text-zinc-200 ring-white/10";
  }
}

function StatCard({
  label,
  value,
  valueClass = "text-white",
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  valueClass?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const className = `rounded-2xl border px-3.5 py-3 text-left transition-colors ${
    active
      ? "border-rose-500/50 bg-rose-500/10"
      : "border-white/10 bg-zinc-900/60 hover:border-white/20"
  } ${onClick ? "cursor-pointer" : "cursor-default"}`;

  const inner = (
    <>
      <div className="flex items-center gap-1.5">
        <span className="truncate text-xs font-medium tracking-wide text-zinc-400">
          {label}
        </span>
        {active && (
          <span className="ml-auto inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
        )}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value.toLocaleString()}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

const SelectChevron = () => (
  <svg
    viewBox="0 0 8 5"
    width="8"
    height="5"
    fill="none"
    className="pointer-events-none col-start-2 row-start-1 place-self-center text-current opacity-60"
  >
    <path d="M.5.5 4 4 7.5.5" stroke="currentColor" />
  </svg>
);

export default function TicketManagementClient({
  initialTickets,
  initialTotal,
  initialScannedCount,
  initialUnscannedCount,
  initialFeeWaiverCount,
  initialFilteredCount,
  initialStandardCount,
  initialVipCount,
  initialExternalCount,
  initialStandbyCount,
  initialAffiliationCounts,
}: TicketManagementClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { events, selectedEventId } = useEventContext();
  const { confirm: confirmAction, confirmationDialog } =
    useConfirmationDialog();
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [total, setTotal] = useState(initialTotal);
  const [scannedCount, setScannedCount] = useState(initialScannedCount);
  const [unscannedCount, setUnscannedCount] = useState(initialUnscannedCount);
  const [feeWaiverCount, setFeeWaiverCount] = useState(initialFeeWaiverCount);
  const [filteredCount, setFilteredCount] = useState(initialFilteredCount);
  const [standardCount, setStandardCount] = useState(initialStandardCount);
  const [vipCount, setVipCount] = useState(initialVipCount);
  const [externalCount, setExternalCount] = useState(initialExternalCount);
  const [standbyCount, setStandbyCount] = useState(initialStandbyCount);
  const [affiliationCounts, setAffiliationCounts] = useState<AffiliationCounts>(
    initialAffiliationCounts,
  );
  const [search, setSearch] = useState("");
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string>("");
  const [scannedFilter, setScannedFilter] = useState<string>("");
  const [feeWaiverFilter, setFeeWaiverFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTicketRows, setNewTicketRows] = useState<TicketRow[]>([
    { name: "", email: "", title: "" },
  ]);
  const [newTicketEventId, setNewTicketEventId] = useState(selectedEventId);
  const [newTicketType, setNewTicketType] = useState("VIP");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [emailLookups, setEmailLookups] = useState<
    Record<number, EmailLookupResult>
  >({});
  const lookupTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {},
  );
  const lookupAbortControllers = useRef<Record<number, AbortController>>({});
  // Tracks the in-flight main-list request so a newer fetch (e.g. after an
  // event switch) supersedes and discards the stale one — last call wins.
  const fetchAbortRef = useRef<AbortController | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(
    null,
  );
  const [isSendingEarlyReminders, setIsSendingEarlyReminders] = useState(false);
  const [sendingEarlyReminderId, setSendingEarlyReminderId] = useState<
    string | null
  >(null);
  const [bulkReminderState, setBulkReminderState] =
    useState<BulkSendProgressState | null>(null);
  const [massEmailType, setMassEmailType] = useState<"early" | "day-of">(
    "early",
  );
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  // Per-row in-flight saves so titles mutate independently — saving one row
  // never disables or closes the editor of another as you go down the list.
  const [savingTitleIds, setSavingTitleIds] = useState<Set<string>>(
    () => new Set(),
  );
  // Titles are hidden by default (only a few guests have one). The toggle
  // reveals every title; revealedTitleIds reveals individual rows on demand.
  const [showTitles, setShowTitles] = useState(false);
  const [revealedTitleIds, setRevealedTitleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportScope, setExportScope] = useState<"filtered" | "all">(
    "filtered",
  );
  const [deleteModalTicket, setDeleteModalTicket] = useState<Ticket | null>(
    null,
  );
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);
  const [shouldSendCancellationEmail, setShouldSendCancellationEmail] =
    useState(true);
  const rawAffiliationFilter = searchParams.get("affiliation");
  const affiliationFilter = AFFILIATION_FILTER_ORDER.includes(
    rawAffiliationFilter as TicketAffiliationKey,
  )
    ? (rawAffiliationFilter as TicketAffiliationKey)
    : "";

  const REMINDER_CHUNK_SIZE = REMINDER_EMAIL_BATCH_SIZE;
  const RECIPIENT_PAGE_SIZE = 500;

  function resetNewTicketForm() {
    setNewTicketRows([{ name: "", email: "", title: "" }]);
    setNewTicketEventId(selectedEventId);
    setNewTicketType("VIP");
    setEmailLookups({});
  }

  const debouncedEmailLookup = useCallback(
    (index: number, email: string, eventId: string) => {
      // Clear any pending timer for this row
      if (lookupTimers.current[index]) {
        clearTimeout(lookupTimers.current[index]);
      }
      // Abort any in-flight request for this row
      if (lookupAbortControllers.current[index]) {
        lookupAbortControllers.current[index].abort();
      }

      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !isValidEmail(trimmed) || !eventId) {
        setEmailLookups((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
        return;
      }

      lookupTimers.current[index] = setTimeout(async () => {
        const controller = new AbortController();
        lookupAbortControllers.current[index] = controller;
        try {
          const res = await fetch(
            `/api/tickets/lookup?email=${encodeURIComponent(trimmed)}&eventId=${encodeURIComponent(eventId)}`,
            { signal: controller.signal },
          );
          if (!res.ok) return;
          const data = await res.json();
          if (!controller.signal.aborted) {
            setEmailLookups((prev) => ({
              ...prev,
              [index]: data.ticket
                ? { type: data.ticket.type, name: data.ticket.name }
                : null,
            }));
          }
        } catch {
          // Aborted or network error — silently ignore
        }
      }, 400);
    },
    [],
  );

  function handleSpreadsheetPaste(
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) {
    const clipboardText = event.clipboardData.getData("text");

    if (!clipboardText.includes("\t")) {
      return;
    }

    const parsedRows = parseSpreadsheetTicketRows(clipboardText);

    event.preventDefault();

    if (parsedRows.length === 0) {
      setSuccess(null);
      setError("Paste exactly 2 columns from Google Sheets: name and email.");
      return;
    }

    setNewTicketRows((prev) => {
      const next = [...prev];
      const requiredLength = index + parsedRows.length;

      while (next.length < requiredLength) {
        next.push({ name: "", email: "", title: "" });
      }

      parsedRows.forEach((row, offset) => {
        next[index + offset] = row;
      });

      return next;
    });

    setError(null);
    setSuccess(
      `Loaded ${parsedRows.length} attendee row${parsedRows.length === 1 ? "" : "s"} from pasted data.`,
    );

    // Trigger lookups for all pasted rows
    parsedRows.forEach((row, offset) => {
      debouncedEmailLookup(index + offset, row.email, newTicketEventId);
    });
  }

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    setBulkReminderState(null);
  }, [selectedEventId]);

  useEffect(() => {
    setFeeWaiverFilter("");
  }, [selectedEventId]);

  useEffect(() => {
    setOffset(0);
  }, [selectedEventId, affiliationFilter]);

  function handleAffiliationFilterChange(
    nextAffiliation: TicketAffiliationKey | "",
  ) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextAffiliation) {
      params.set("affiliation", nextAffiliation);
    } else {
      params.delete("affiliation");
    }

    setOffset(0);
    router.replace(
      params.size > 0 ? `${pathname}?${params.toString()}` : pathname,
    );
  }

  async function fetchTickets() {
    // Supersede any in-flight request so a newer fetch (event switch, filter
    // change, manual refresh) always wins and stale responses are discarded.
    fetchAbortRef.current?.abort();

    // Don't fetch if no event is selected
    if (!selectedEventId) {
      fetchAbortRef.current = null;
      setTickets([]);
      setTotal(0);
      setScannedCount(0);
      setUnscannedCount(0);
      setFeeWaiverCount(0);
      setFilteredCount(0);
      setStandardCount(0);
      setVipCount(0);
      setExternalCount(0);
      setStandbyCount(0);
      setAffiliationCounts(createEmptyAffiliationCounts());
      return;
    }

    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const { signal } = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (selectedEventId) {
        params.append("eventId", selectedEventId);
      }

      if (search.trim()) {
        params.append("search", search.trim());
      }

      if (ticketTypeFilter) {
        params.append("type", ticketTypeFilter);
      }

      if (scannedFilter) {
        params.append("scanned", scannedFilter);
      }
      if (feeWaiverFilter) {
        params.append("feeWaiver", feeWaiverFilter);
      }
      if (affiliationFilter) {
        params.append("affiliation", affiliationFilter);
      }

      const response = await fetch(`/api/tickets?${params}`, { signal });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch tickets");
      }

      const data = await response.json();
      if (signal.aborted) return;
      setTickets(data.tickets || []);
      setTotal(data.total || 0);
      setScannedCount(data.scannedCount || 0);
      setUnscannedCount(data.unscannedCount || 0);
      setFeeWaiverCount(data.feeWaiverCount || 0);
      setFilteredCount(data.filteredCount || 0);
      setStandardCount(data.standardCount || 0);
      setVipCount(data.vipCount || 0);
      setExternalCount(data.externalCount || 0);
      setStandbyCount(data.standbyCount || 0);
      setAffiliationCounts(
        data.affiliationCounts || createEmptyAffiliationCounts(),
      );
    } catch (err) {
      if (
        signal.aborted ||
        (err as { name?: string } | null)?.name === "AbortError"
      ) {
        return;
      }
      console.error("Error fetching tickets:", err);
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }

  const fetchTicketsForEffect = useEffectEvent(() => {
    void fetchTickets();
  });

  async function fetchAllReminderRecipients(
    eventId: string,
  ): Promise<ReminderRecipient[]> {
    const recipients: ReminderRecipient[] = [];

    for (
      let recipientOffset = 0;
      recipientOffset < total;
      recipientOffset += RECIPIENT_PAGE_SIZE
    ) {
      const params = new URLSearchParams({
        eventId,
        limit: Math.min(
          RECIPIENT_PAGE_SIZE,
          total - recipientOffset,
        ).toString(),
        offset: recipientOffset.toString(),
      });
      const response = await fetch(`/api/tickets?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || "Failed to load reminder recipients",
        );
      }

      const data = (await response.json()) as { tickets?: ReminderRecipient[] };
      const pageRecipients = data.tickets || [];
      recipients.push(
        ...pageRecipients.map((ticket) => ({
          id: ticket.id,
          email: ticket.email,
        })),
      );

      if (pageRecipients.length < RECIPIENT_PAGE_SIZE) {
        break;
      }
    }

    return recipients;
  }

  async function sendBulkReminderEmails(options: {
    action: "sendEarlyReminders" | "sendDayOfReminders";
    eventId: string;
    label: string;
    successLabel: string;
  }) {
    const recipients = await fetchAllReminderRecipients(options.eventId);

    if (recipients.length === 0) {
      setSuccess("No tickets found for this event.");
      return;
    }

    const finalState = await runChunkedSend({
      items: recipients,
      chunkSize: REMINDER_CHUNK_SIZE,
      label: options.label,
      onProgress: setBulkReminderState,
      sendChunk: async (chunk, context) => {
        const response = await fetch(
          `/api/tickets?eventId=${options.eventId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: options.action,
              auditBatchId: context.batchId,
              ticketIds: chunk.map((recipient) => recipient.id),
            }),
          },
        );
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to send reminder emails");
        }

        return data;
      },
    });

    const suppressedMsg =
      finalState.suppressed > 0 ? `, ${finalState.suppressed} suppressed` : "";
    setSuccess(
      `${options.successLabel} ${finalState.sent} sent, ${finalState.failed} failed${suppressedMsg}.`,
    );
  }

  useEffect(() => {
    fetchTicketsForEffect();
  }, [
    selectedEventId,
    offset,
    ticketTypeFilter,
    scannedFilter,
    feeWaiverFilter,
    affiliationFilter,
  ]);

  // Abort any in-flight tickets request on unmount.
  useEffect(() => {
    return () => fetchAbortRef.current?.abort();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      fetchTicketsForEffect();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function openDeleteModal(ticket: Ticket) {
    setDeleteModalTicket(ticket);
    setShouldSendCancellationEmail(true);
  }

  async function confirmDelete() {
    if (!deleteModalTicket) return;
    const id = deleteModalTicket.id;
    const ticketToDelete = deleteModalTicket;

    try {
      setIsDeletingTicket(true);
      const response = await fetch("/api/tickets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          sendCancellationEmail: shouldSendCancellationEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete ticket");
      }

      setTickets((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => prev - 1);
      // Update scanned/unscanned counts
      if (ticketToDelete.scanned) {
        setScannedCount((prev) => prev - 1);
      } else {
        setUnscannedCount((prev) => prev - 1);
      }
      if (ticketToDelete.has_fee_waiver) {
        setFeeWaiverCount((prev: number) => prev - 1);
      }
      // Update ticket type counts
      if (ticketToDelete.type === "STANDARD") {
        setStandardCount((prev) => prev - 1);
      } else if (ticketToDelete.type === "EXTERNAL") {
        setExternalCount((prev) => prev - 1);
      } else if (ticketToDelete.type === "STANDBY") {
        setStandbyCount((prev) => prev - 1);
      } else {
        setVipCount((prev) => prev - 1);
      }
      setSuccess(
        shouldSendCancellationEmail
          ? "Ticket deleted and cancellation email sent!"
          : "Ticket deleted successfully!",
      );
    } catch (err) {
      console.error("Error deleting ticket:", err);
      setError(err instanceof Error ? err.message : "Failed to delete ticket");
    } finally {
      setIsDeletingTicket(false);
      setDeleteModalTicket(null);
    }
  }

  async function handleUpdateType(id: string, newType: string) {
    // Find the ticket to check its current type
    const ticket = tickets.find((t) => t.id === id);
    const oldType = ticket?.type;

    setUpdatingTicketId(id);
    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "updateType", type: newType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update ticket type");
      }

      const data = await response.json();
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? (data.ticket as Ticket) : t)),
      );
      // Update ticket type counts if type actually changed
      if (oldType !== newType) {
        if (oldType === "STANDARD") setStandardCount((prev) => prev - 1);
        else if (oldType === "VIP") setVipCount((prev) => prev - 1);
        else if (oldType === "EXTERNAL") setExternalCount((prev) => prev - 1);
        else if (oldType === "STANDBY") setStandbyCount((prev) => prev - 1);

        if (newType === "STANDARD") setStandardCount((prev) => prev + 1);
        else if (newType === "VIP") setVipCount((prev) => prev + 1);
        else if (newType === "EXTERNAL") setExternalCount((prev) => prev + 1);
        else if (newType === "STANDBY") setStandbyCount((prev) => prev + 1);
      }
      setSuccess("Ticket type updated successfully!");
    } catch (err) {
      console.error("Error updating ticket type:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update ticket type",
      );
    } finally {
      setUpdatingTicketId(null);
    }
  }

  async function handleUpdateScanned(id: string, newScanned: boolean) {
    // Find the ticket to check its current scanned status
    const ticket = tickets.find((t) => t.id === id);
    const wasScanned = ticket?.scanned;

    setUpdatingTicketId(id);
    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: "updateScanned",
          scanned: newScanned,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update scanned status");
      }

      const data = await response.json();
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? (data.ticket as Ticket) : t)),
      );
      // Update counts based on the change
      if (wasScanned && !newScanned) {
        // Was scanned, now unscanned
        setScannedCount((prev) => prev - 1);
        setUnscannedCount((prev) => prev + 1);
      } else if (!wasScanned && newScanned) {
        // Was unscanned, now scanned
        setScannedCount((prev) => prev + 1);
        setUnscannedCount((prev) => prev - 1);
      }
      setSuccess("Scanned status updated successfully!");
    } catch (err) {
      console.error("Error updating scanned status:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update scanned status",
      );
    } finally {
      setUpdatingTicketId(null);
    }
  }

  async function handleUpdateName(id: string, newName: string) {
    const trimmed = newName.trim();
    const ticket = tickets.find((t) => t.id === id);
    // Don't update if value hasn't changed
    if ((ticket?.name || "") === trimmed) {
      setEditingNameId(null);
      return;
    }

    setUpdatingTicketId(id);
    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "updateName", name: trimmed }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update name");
      }

      const data = await response.json();
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? (data.ticket as Ticket) : t)),
      );
      setSuccess("Name updated successfully!");
    } catch (err) {
      console.error("Error updating name:", err);
      setError(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setUpdatingTicketId(null);
      setEditingNameId(null);
    }
  }

  async function handleUpdateTitle(id: string, newTitle: string) {
    const trimmed = newTitle.trim();
    const ticket = tickets.find((t) => t.id === id);
    const previousTitle = ticket?.title ?? null;

    // Close this row's editor right away (only if it's still the open one) so
    // you can immediately move to the next row — the save runs in the
    // background and won't disturb whatever you edit next.
    setEditingTitleId((prev) => (prev === id ? null : prev));

    // No change → nothing to save.
    if ((previousTitle || "") === trimmed) {
      return;
    }
    const nextTitle = trimmed || null;

    // Optimistically reflect the new value and keep the row revealed, then
    // track this save per-row so concurrent saves stay independent.
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: nextTitle } : t)),
    );
    setRevealedTitleIds((prev) => new Set(prev).add(id));
    setSavingTitleIds((prev) => new Set(prev).add(id));
    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "updateTitle", title: trimmed }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update title");
      }

      const data = await response.json();
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? (data.ticket as Ticket) : t)),
      );
    } catch (err) {
      console.error("Error updating title:", err);
      // Revert just this row's optimistic change.
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: previousTitle } : t)),
      );
      setError(err instanceof Error ? err.message : "Failed to update title");
    } finally {
      setSavingTitleIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleExport(scope: "filtered" | "all") {
    if (!selectedEventId) return;
    setIsExporting(true);
    setError(null);
    try {
      // Pull every matching row in one request. "filtered" mirrors the active
      // filters; "all" exports the whole event regardless of filters. Both are
      // scoped to the selected event — the page itself is event-scoped.
      const params = new URLSearchParams({
        eventId: selectedEventId,
        limit: "100000",
        offset: "0",
      });
      if (scope === "filtered") {
        if (search.trim()) params.append("search", search.trim());
        if (ticketTypeFilter) params.append("type", ticketTypeFilter);
        if (scannedFilter) params.append("scanned", scannedFilter);
        if (feeWaiverFilter) params.append("feeWaiver", feeWaiverFilter);
        if (affiliationFilter) params.append("affiliation", affiliationFilter);
      }

      const response = await fetch(`/api/tickets?${params}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export tickets");
      }
      const data = await response.json();
      const exportTickets = (data.tickets as Ticket[]) || [];

      const rows = [
        [
          "Name",
          "Title",
          "Email",
          "Type",
          "Status",
          "Scanned at",
          "Created",
          "Referral",
          "Fee waiver",
          "Event",
        ],
        ...exportTickets.map((t) => [
          t.name || "",
          t.title || "",
          t.email,
          t.type || "",
          t.scanned ? "Scanned" : "Not scanned",
          t.scan_time ? formatDate(t.scan_time) : "",
          formatDate(t.created_at),
          t.referral || "",
          t.has_fee_waiver ? "Yes" : "No",
          t.events?.name || "",
        ]),
      ];

      const csv = rows
        .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const eventName =
        events.find((e) => e.id === selectedEventId)?.name || "event";
      const eventSlug =
        eventName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "event";
      link.href = url;
      link.download = `tickets-${eventSlug}-${scope}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setSuccess(`Exported ${exportTickets.length} ticket(s) to CSV`);
    } catch (err) {
      console.error("Error exporting tickets:", err);
      setError(err instanceof Error ? err.message : "Failed to export tickets");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleResendEmail(id: string) {
    const ticket = tickets.find((item) => item.id === id);
    const shouldResend = await confirmAction({
      title: "Resend confirmation email?",
      description: (
        <>
          This will resend the ticket confirmation to{" "}
          <span className="font-medium text-white">
            {ticket?.email || "this ticket holder"}
          </span>
          .
        </>
      ),
      confirmLabel: "Resend email",
      tone: "primary",
    });
    if (!shouldResend) return;

    setResendingEmailId(id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "resendEmail" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to resend email");
      }

      setSuccess("Email resent successfully!");
    } catch (err) {
      console.error("Error resending email:", err);
      setError(err instanceof Error ? err.message : "Failed to resend email");
    } finally {
      setResendingEmailId(null);
    }
  }

  async function handleSendDayOfReminders() {
    if (!selectedEventId) {
      setError("Please select an event first");
      return;
    }

    const selectedEvent = events.find((e) => e.id === selectedEventId);
    const eventName = selectedEvent?.name || "this event";

    const shouldSend = await confirmAction({
      title: "Send day-of reminder emails?",
      description: (
        <>
          Send reminders to{" "}
          <span className="font-medium text-white">
            {total.toLocaleString()}
          </span>{" "}
          ticket holders for{" "}
          <span className="font-medium text-white">{eventName}</span>. This
          includes the no-bags policy and ADA accommodation info.
        </>
      ),
      confirmLabel: "Send reminders",
      tone: "primary",
    });
    if (!shouldSend) return;

    setIsSendingReminders(true);
    setError(null);
    setSuccess(null);

    try {
      await sendBulkReminderEmails({
        action: "sendDayOfReminders",
        eventId: selectedEventId,
        label: "Sending day-of reminders",
        successLabel: "Day-of reminders sent!",
      });
    } catch (err) {
      console.error("Error sending day-of reminders:", err);
      setError(
        err instanceof Error ? err.message : "Failed to send day-of reminders",
      );
    } finally {
      setIsSendingReminders(false);
    }
  }

  async function handleSendIndividualReminder(id: string) {
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return;

    const shouldSend = await confirmAction({
      title: "Send day-of reminder?",
      description: (
        <>
          Send the day-of reminder to{" "}
          <span className="font-medium text-white">{ticket.email}</span>. This
          includes the no-bags policy and ADA accommodation info.
        </>
      ),
      confirmLabel: "Send reminder",
      tone: "primary",
    });
    if (!shouldSend) return;

    setSendingReminderId(id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/tickets?eventId=${ticket.event_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "sendDayOfReminder" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reminder");
      }

      setSuccess(`Day-of reminder sent to ${ticket.email}!`);
    } catch (err) {
      console.error("Error sending individual reminder:", err);
      setError(
        err instanceof Error ? err.message : "Failed to send day-of reminder",
      );
    } finally {
      setSendingReminderId(null);
    }
  }

  async function handleSendMassEmail() {
    if (massEmailType === "early") {
      await handleSendEarlyReminders();
    } else {
      await handleSendDayOfReminders();
    }
  }

  async function handleSendEarlyReminders() {
    if (!selectedEventId) {
      setError("Please select an event first");
      return;
    }

    const selectedEvent = events.find((e) => e.id === selectedEventId);
    const eventName = selectedEvent?.name || "this event";

    const shouldSend = await confirmAction({
      title: "Send early reminder emails?",
      description: (
        <>
          Send reminders to{" "}
          <span className="font-medium text-white">
            {total.toLocaleString()}
          </span>{" "}
          ticket holders for{" "}
          <span className="font-medium text-white">{eventName}</span>. This
          includes doors open time, ticket validity, and the no-bags notice.
        </>
      ),
      confirmLabel: "Send reminders",
      tone: "primary",
    });
    if (!shouldSend) return;

    setIsSendingEarlyReminders(true);
    setError(null);
    setSuccess(null);

    try {
      await sendBulkReminderEmails({
        action: "sendEarlyReminders",
        eventId: selectedEventId,
        label: "Sending early reminders",
        successLabel: "Early reminders sent!",
      });
    } catch (err) {
      console.error("Error sending early reminders:", err);
      setError(
        err instanceof Error ? err.message : "Failed to send early reminders",
      );
    } finally {
      setIsSendingEarlyReminders(false);
    }
  }

  async function handleSendIndividualEarlyReminder(id: string) {
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return;

    const shouldSend = await confirmAction({
      title: "Send early reminder?",
      description: (
        <>
          Send the early reminder to{" "}
          <span className="font-medium text-white">{ticket.email}</span>. This
          includes doors open time, ticket validity, and the no-bags notice.
        </>
      ),
      confirmLabel: "Send reminder",
      tone: "primary",
    });
    if (!shouldSend) return;

    setSendingEarlyReminderId(id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/tickets?eventId=${ticket.event_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: "sendEarlyReminder",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send early reminder");
      }

      setSuccess(`Early reminder sent to ${ticket.email}!`);
    } catch (err) {
      console.error("Error sending individual early reminder:", err);
      setError(
        err instanceof Error ? err.message : "Failed to send early reminder",
      );
    } finally {
      setSendingEarlyReminderId(null);
    }
  }

  async function handleAddTicket(e: React.FormEvent) {
    e.preventDefault();

    const rowsWithEmail = newTicketRows.filter((row) => row.email.trim());
    if (rowsWithEmail.length === 0) {
      setError("Please enter at least one email address");
      return;
    }

    const rowsMissingName = rowsWithEmail.filter((row) => !row.name.trim());
    if (rowsMissingName.length > 0) {
      setError("Name is required for each ticket.");
      return;
    }

    if (!newTicketEventId) {
      setError("Please select an event");
      return;
    }

    const rowsToSubmit = newTicketRows.filter(
      (row) => row.email.trim() && row.name.trim(),
    );
    const invalidRows = rowsToSubmit.filter(
      (row) => !isValidEmail(row.email.trim()),
    );
    if (invalidRows.length > 0) {
      setError(
        `Invalid email(s): ${invalidRows.map((r) => r.email).join(", ")}`,
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress({ completed: 0, total: rowsToSubmit.length });
    setError(null);
    setSuccess(null);

    let successCount = 0;
    const errors: string[] = [];
    const createdTickets: Ticket[] = [];

    for (const row of rowsToSubmit) {
      const email = row.email.trim().toLowerCase();
      const name = row.name.trim();
      const title = row.title.trim();
      try {
        const response = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            name,
            title,
            eventId: newTicketEventId,
            type: newTicketType,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          errors.push(`${email}: ${data.error || "Failed to create ticket"}`);
          setSubmitProgress((prev) => ({
            ...prev,
            completed: prev.completed + 1,
          }));
          continue;
        }

        createdTickets.push(data.ticket as Ticket);
        successCount++;
      } catch (err) {
        console.error(`Error creating ticket for ${email}:`, err);
        errors.push(
          `${email}: ${err instanceof Error ? err.message : "Failed to create ticket"}`,
        );
      }
      setSubmitProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
    }

    if (successCount > 0) {
      setTickets((prev) => [...createdTickets, ...prev]);
      setTotal((prev) => prev + successCount);
      setUnscannedCount((prev) => prev + successCount);
      setFeeWaiverCount(
        (prev: number) =>
          prev +
          createdTickets.filter((ticket) => ticket.has_fee_waiver).length,
      );
      if (newTicketType === "STANDARD") {
        setStandardCount((prev) => prev + successCount);
      } else if (newTicketType === "EXTERNAL") {
        setExternalCount((prev) => prev + successCount);
      } else if (newTicketType === "STANDBY") {
        setStandbyCount((prev) => prev + successCount);
      } else {
        setVipCount((prev) => prev + successCount);
      }
      setSuccess(
        `Successfully created ${successCount} ticket(s)${errors.length > 0 ? ` (${errors.length} failed)` : ""}`,
      );
      resetNewTicketForm();
      if (errors.length === 0) {
        setShowAddForm(false);
      }
    }

    if (errors.length > 0 && successCount === 0) {
      setError(`Failed to create tickets: ${errors.join("; ")}`);
    } else if (errors.length > 0) {
      setError(`Some tickets failed: ${errors.join("; ")}`);
    }

    setIsSubmitting(false);
  }

  const visibleAffiliationStats = AFFILIATION_FILTER_ORDER.filter(
    (key) => affiliationCounts[key] > 0,
  ).map((key) => ({
    key,
    label: formatAffiliationLabel(key),
    value: affiliationCounts[key],
  }));

  const filtersActive = Boolean(
    search ||
    ticketTypeFilter ||
    scannedFilter ||
    feeWaiverFilter ||
    affiliationFilter,
  );

  function toggleTypeFilter(type: string) {
    setTicketTypeFilter((prev) => (prev === type ? "" : type));
    setOffset(0);
  }

  function toggleScannedFilter(value: string) {
    setScannedFilter((prev) => (prev === value ? "" : value));
    setOffset(0);
  }

  function toggleFeeWaiverFilter() {
    setFeeWaiverFilter((prev) => (prev === "true" ? "" : "true"));
    setOffset(0);
  }

  function renderNameCell(ticket: Ticket) {
    if (editingNameId === ticket.id) {
      return (
        <input
          type="text"
          name="ticket-name"
          aria-label="Ticket holder name"
          value={editingNameValue}
          onChange={(e) => setEditingNameValue(e.target.value)}
          onBlur={() => handleUpdateName(ticket.id, editingNameValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleUpdateName(ticket.id, editingNameValue);
            } else if (e.key === "Escape") {
              setEditingNameId(null);
            }
          }}
          autoFocus
          disabled={updatingTicketId === ticket.id}
          className="w-full rounded-lg bg-white/5 px-2 py-1 text-base text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-rose-500 disabled:opacity-50 sm:text-sm"
          placeholder="Enter name"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          setEditingNameId(ticket.id);
          setEditingNameValue(ticket.name || "");
        }}
        className="group inline-flex max-w-full items-center gap-1.5 text-left text-sm font-medium text-zinc-200 transition-colors hover:text-white"
        title="Click to edit name"
      >
        <span className="truncate">{ticket.name || "—"}</span>
        <PencilIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    );
  }

  function renderTitleCell(ticket: Ticket) {
    if (editingTitleId === ticket.id) {
      return (
        <input
          type="text"
          name="ticket-title"
          aria-label="Ticket holder title"
          value={editingTitleValue}
          onChange={(e) => setEditingTitleValue(e.target.value)}
          onBlur={() => handleUpdateTitle(ticket.id, editingTitleValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleUpdateTitle(ticket.id, editingTitleValue);
            } else if (e.key === "Escape") {
              setEditingTitleId(null);
            }
          }}
          autoFocus
          disabled={savingTitleIds.has(ticket.id)}
          className="w-full rounded-lg bg-white/5 px-2 py-1 text-base text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-rose-500 disabled:opacity-50 sm:text-sm"
          placeholder="Enter title"
        />
      );
    }

    const revealed = showTitles || revealedTitleIds.has(ticket.id);

    // Hidden state: rows that have a title get a click-to-reveal control;
    // rows without one stay blank so the column reads as mostly empty.
    if (!revealed) {
      if (!ticket.title) {
        // No title yet: a quiet click-to-add affordance (a "+" surfaces on
        // hover) that opens the editor directly, no reveal step needed.
        return (
          <button
            type="button"
            onClick={() => {
              setEditingTitleId(ticket.id);
              setEditingTitleValue("");
            }}
            className="group inline-flex items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-zinc-300"
            title="Add title"
          >
            <span>—</span>
            <PlusIcon
              aria-hidden="true"
              className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        );
      }
      return (
        <button
          type="button"
          onClick={() =>
            setRevealedTitleIds((prev) => {
              const next = new Set(prev);
              next.add(ticket.id);
              return next;
            })
          }
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-500 ring-1 ring-inset ring-white/10 transition-colors hover:text-zinc-200 hover:ring-white/20"
          title="Show title"
        >
          <EyeIcon aria-hidden="true" className="size-3.5 shrink-0" />
          Title
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          setEditingTitleId(ticket.id);
          setEditingTitleValue(ticket.title || "");
        }}
        className="group inline-flex max-w-full items-center gap-1.5 text-left text-sm text-zinc-300 transition-colors hover:text-white"
        title="Click to edit title"
      >
        <span className="truncate">{ticket.title || "—"}</span>
        <PencilIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    );
  }

  function renderTypeSelect(ticket: Ticket) {
    const type = ticket.type || "STANDARD";
    return (
      <div className="inline-grid grid-cols-[1fr_--spacing(7)] items-center">
        <select
          aria-label="Ticket type"
          value={type}
          onChange={(e) => {
            if (e.target.value !== ticket.type) {
              handleUpdateType(ticket.id, e.target.value);
            }
          }}
          disabled={updatingTicketId === ticket.id}
          className={`col-span-full row-start-1 appearance-none rounded-lg py-1.5 pr-7 pl-2.5 text-xs font-semibold ring-1 ring-inset focus:outline-2 focus:-outline-offset-1 focus:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-50 sm:py-1 ${typeBadgeClasses(type)}`}
        >
          {TICKET_TYPES.map((t) => (
            <option key={t} value={t} className="bg-zinc-900 text-white">
              {t}
            </option>
          ))}
        </select>
        <SelectChevron />
      </div>
    );
  }

  function renderScannedSelect(ticket: Ticket) {
    return (
      <div className="inline-grid grid-cols-[1fr_--spacing(7)] items-center">
        <select
          aria-label="Scanned status"
          value={ticket.scanned ? "scanned" : "not-scanned"}
          onChange={(e) => {
            const newScanned = e.target.value === "scanned";
            if (newScanned !== ticket.scanned) {
              handleUpdateScanned(ticket.id, newScanned);
            }
          }}
          disabled={updatingTicketId === ticket.id}
          className={`col-span-full row-start-1 appearance-none rounded-lg py-1.5 pr-7 pl-2.5 text-xs font-semibold ring-1 ring-inset focus:outline-2 focus:-outline-offset-1 focus:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-50 sm:py-1 ${
            ticket.scanned
              ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25"
              : "bg-white/5 text-zinc-200 ring-white/10"
          }`}
        >
          <option value="scanned" className="bg-zinc-900 text-white">
            Scanned
          </option>
          <option value="not-scanned" className="bg-zinc-900 text-white">
            Not scanned
          </option>
        </select>
        <SelectChevron />
      </div>
    );
  }

  function renderActions(ticket: Ticket) {
    const spinner = (color: string) => (
      <div
        className={`h-5 w-5 animate-spin rounded-full border-2 border-t-transparent ${color}`}
      />
    );
    return (
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => handleResendEmail(ticket.id)}
          disabled={resendingEmailId === ticket.id}
          className="rounded-md p-2 text-blue-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
          title="Resend confirmation email"
        >
          {resendingEmailId === ticket.id ? (
            spinner("border-blue-400")
          ) : (
            <EnvelopeIcon aria-hidden="true" className="size-4 shrink-0" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSendIndividualEarlyReminder(ticket.id)}
          disabled={sendingEarlyReminderId === ticket.id}
          className="rounded-md p-2 text-violet-400 transition-colors hover:bg-violet-500/10 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
          title="Send early reminder"
        >
          {sendingEarlyReminderId === ticket.id ? (
            spinner("border-violet-400")
          ) : (
            <ClockIcon aria-hidden="true" className="size-4 shrink-0" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSendIndividualReminder(ticket.id)}
          disabled={sendingReminderId === ticket.id}
          className="rounded-md p-2 text-amber-400 transition-colors hover:bg-amber-500/10 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          title="Send day-of reminder"
        >
          {sendingReminderId === ticket.id ? (
            spinner("border-amber-400")
          ) : (
            <BellIcon aria-hidden="true" className="size-4 shrink-0" />
          )}
        </button>
        <button
          type="button"
          onClick={() => openDeleteModal(ticket)}
          className="rounded-md p-2 text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
          title="Delete ticket"
        >
          <TrashIcon aria-hidden="true" className="size-4 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title="Ticket management"
          subtitle={
            selectedEventId ? (
              <>
                <span className="font-semibold text-zinc-200">
                  {total.toLocaleString()}
                </span>{" "}
                ticket{total === 1 ? "" : "s"} sold
                {filtersActive && (
                  <>
                    {" · "}
                    <span className="font-semibold text-blue-300">
                      {filteredCount.toLocaleString()}
                    </span>{" "}
                    matching filters
                  </>
                )}
              </>
            ) : (
              "Select an event to manage tickets"
            )
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-stretch overflow-hidden rounded-lg bg-white/5 ring-1 ring-inset ring-white/10">
            <select
              value={massEmailType}
              onChange={(e) =>
                setMassEmailType(e.target.value as "early" | "day-of")
              }
              disabled={
                isSendingEarlyReminders ||
                isSendingReminders ||
                !selectedEventId ||
                total === 0
              }
              className="appearance-none border-0 bg-transparent bg-[length:1rem_1rem] bg-[right_0.75rem_center] bg-no-repeat py-2 pr-8 pl-3.5 text-sm font-medium text-zinc-200 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              }}
              aria-label="Email type"
            >
              <option value="early">Early reminders</option>
              <option value="day-of">Day-of reminders</option>
            </select>
            <button
              type="button"
              onClick={handleSendMassEmail}
              disabled={
                !selectedEventId ||
                total === 0 ||
                isSendingEarlyReminders ||
                isSendingReminders
              }
              className="flex items-center gap-2 border-l border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                massEmailType === "early"
                  ? "Send early reminder emails to all ticket holders"
                  : "Send day-of reminder emails to all ticket holders"
              }
            >
              {isSendingEarlyReminders || isSendingReminders ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <EnvelopeIcon aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <div className="flex items-stretch overflow-hidden rounded-lg bg-white/5 ring-1 ring-inset ring-white/10">
            <select
              value={exportScope}
              onChange={(e) =>
                setExportScope(e.target.value as "filtered" | "all")
              }
              disabled={!selectedEventId || isExporting}
              className="appearance-none border-0 bg-transparent bg-[length:1rem_1rem] bg-[right_0.75rem_center] bg-no-repeat py-2 pr-8 pl-3.5 text-sm font-medium text-zinc-200 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              }}
              aria-label="Export scope"
            >
              <option value="filtered">Current filter</option>
              <option value="all">All tickets</option>
            </select>
            <button
              type="button"
              onClick={() => handleExport(exportScope)}
              disabled={!selectedEventId || isExporting}
              className="flex items-center gap-2 border-l border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                exportScope === "filtered"
                  ? "Export tickets matching the current filters to CSV"
                  : "Export all tickets for this event to CSV"
              }
            >
              {isExporting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <ArrowDownTrayIcon aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
          <Button
            onClick={() => fetchTickets()}
            disabled={isLoading}
            className="flex items-center gap-2"
            title="Reload tickets"
          >
            <ArrowPathIcon
              aria-hidden="true"
              className={`size-4 shrink-0 ${isLoading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Reload</span>
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowAddForm((prev) => {
                // When opening the form, default the event dropdown to the
                // event currently being viewed.
                if (!prev) {
                  setNewTicketEventId(selectedEventId);
                }
                return !prev;
              });
            }}
            className="flex items-center gap-2"
          >
            <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
            Add ticket
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      {selectedEventId && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total sold" value={total} />
          <StatCard
            label="Standard"
            value={standardCount}
            valueClass="text-zinc-200"
            active={ticketTypeFilter === "STANDARD"}
            onClick={() => toggleTypeFilter("STANDARD")}
          />
          <StatCard
            label="VIP"
            value={vipCount}
            valueClass="text-blue-300"
            active={ticketTypeFilter === "VIP"}
            onClick={() => toggleTypeFilter("VIP")}
          />
          <StatCard
            label="External"
            value={externalCount}
            valueClass="text-emerald-300"
            active={ticketTypeFilter === "EXTERNAL"}
            onClick={() => toggleTypeFilter("EXTERNAL")}
          />
          <StatCard
            label="Standby"
            value={standbyCount}
            valueClass="text-amber-300"
            active={ticketTypeFilter === "STANDBY"}
            onClick={() => toggleTypeFilter("STANDBY")}
          />
          <StatCard
            label="Scanned"
            value={scannedCount}
            valueClass="text-emerald-300"
            active={scannedFilter === "true"}
            onClick={() => toggleScannedFilter("true")}
          />
          <StatCard
            label="Not scanned"
            value={unscannedCount}
            valueClass="text-zinc-200"
            active={scannedFilter === "false"}
            onClick={() => toggleScannedFilter("false")}
          />
          {feeWaiverCount > 0 && (
            <StatCard
              label="Fee waiver"
              value={feeWaiverCount}
              valueClass="text-amber-300"
              active={feeWaiverFilter === "true"}
              onClick={toggleFeeWaiverFilter}
            />
          )}
        </div>
      )}

      {/* Messages */}
      {error && (
        <Alert tone="error" onDismiss={() => setError(null)} className="mb-6">
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          tone="success"
          onDismiss={() => setSuccess(null)}
          className="mb-6"
        >
          {success}
        </Alert>
      )}

      {bulkReminderState && (
        <div className="mb-6">
          <BulkSendProgress
            state={bulkReminderState}
            onDismiss={() => setBulkReminderState(null)}
          />
        </div>
      )}

      {/* Add Ticket Form */}
      {showAddForm && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-white">Add tickets</h2>
          <p className="mt-1 mb-5 text-sm text-zinc-400">
            Each row is one ticket — name and email are required. Paste two
            columns (name, email) from Google Sheets into any field to fill rows
            automatically.
          </p>
          <form onSubmit={handleAddTicket} className="space-y-5">
            {/* Shared: Event + Type */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="add-event" className="mb-1.5 block">
                  Event
                </Label>
                <Select
                  id="add-event"
                  name="event"
                  value={newTicketEventId}
                  onChange={(e) => {
                    const eventId = e.target.value;
                    setNewTicketEventId(eventId);
                    setEmailLookups({});
                    newTicketRows.forEach((row, i) => {
                      debouncedEmailLookup(i, row.email, eventId);
                    });
                  }}
                  required
                >
                  <option value="">Select an event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name || "Unnamed Event"}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="add-type" className="mb-1.5 block">
                  Ticket type
                </Label>
                <Select
                  id="add-type"
                  name="type"
                  value={newTicketType}
                  onChange={(e) => setNewTicketType(e.target.value)}
                >
                  {TICKET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Rows: Name + Email per ticket */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">
                  Attendees ({newTicketRows.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setNewTicketRows((prev) => [
                      ...prev,
                      { name: "", email: "", title: "" },
                    ])
                  }
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
                  Add row
                </button>
              </div>
              <div className="space-y-2">
                {newTicketRows.map((row, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded-lg bg-white/5 p-2 ring-1 ring-inset ring-white/10 sm:flex-row sm:items-center"
                  >
                    <span className="hidden w-6 shrink-0 text-center text-xs font-medium text-zinc-500 tabular-nums sm:block">
                      {index + 1}
                    </span>
                    <Input
                      type="text"
                      name={`attendee-name-${index}`}
                      aria-label={`Attendee ${index + 1} name`}
                      value={row.name}
                      onPaste={(event) => handleSpreadsheetPaste(index, event)}
                      onChange={(e) => {
                        const value = e.target.value;
                        const parsed = parseNameEmailPair(value);
                        setNewTicketRows((prev) => {
                          const next = [...prev];
                          next[index] = parsed
                            ? { ...next[index], ...parsed }
                            : { ...next[index], name: value };
                          return next;
                        });
                        if (parsed) {
                          debouncedEmailLookup(
                            index,
                            parsed.email,
                            newTicketEventId,
                          );
                        }
                      }}
                      placeholder="Attendee name"
                      className="sm:w-1/3 sm:text-sm"
                    />
                    <Input
                      type="text"
                      name={`attendee-title-${index}`}
                      aria-label={`Attendee ${index + 1} title (optional)`}
                      value={row.title}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewTicketRows((prev) => {
                          const next = [...prev];
                          next[index] = { ...next[index], title: value };
                          return next;
                        });
                      }}
                      placeholder="Title (optional)"
                      className="sm:w-1/4 sm:text-sm"
                    />
                    <div className="relative w-full sm:flex-1">
                      <Input
                        type="email"
                        name={`attendee-email-${index}`}
                        aria-label={`Attendee ${index + 1} email`}
                        value={row.email}
                        onPaste={(event) =>
                          handleSpreadsheetPaste(index, event)
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          const parsed = parseNameEmailPair(value);
                          setNewTicketRows((prev) => {
                            const next = [...prev];
                            next[index] = parsed
                              ? { ...next[index], ...parsed }
                              : { ...next[index], email: value };
                            return next;
                          });
                          debouncedEmailLookup(
                            index,
                            parsed ? parsed.email : value,
                            newTicketEventId,
                          );
                        }}
                        placeholder="email@example.com"
                        className="pr-24 sm:text-sm"
                      />
                      {emailLookups[index] ? (
                        <div className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
                          <StatusPill color="amber">Exists</StatusPill>
                          {emailLookups[index]!.type !== newTicketType && (
                            <StatusPill color="blue">
                              {emailLookups[index]!.type}
                            </StatusPill>
                          )}
                        </div>
                      ) : null}
                    </div>
                    {newTicketRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNewTicketRows((prev) =>
                            prev.filter((_, i) => i !== index),
                          );
                          setEmailLookups((prev) => {
                            const next: Record<number, EmailLookupResult> = {};
                            for (const [k, v] of Object.entries(prev)) {
                              const ki = Number(k);
                              if (ki < index) next[ki] = v;
                              else if (ki > index) next[ki - 1] = v;
                            }
                            return next;
                          });
                        }}
                        className="flex shrink-0 items-center justify-center gap-1.5 rounded-md p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-rose-400 sm:gap-0"
                        title="Remove row"
                      >
                        <TrashIcon aria-hidden="true" className="size-4 shrink-0" />
                        <span className="text-sm sm:hidden">Remove row</span>
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse items-stretch gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:gap-4">
              {isSubmitting ? (
                <div className="flex items-center gap-3 px-2 py-1 sm:px-6 sm:py-3">
                  <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all duration-300"
                      style={{
                        width: `${submitProgress.total ? (submitProgress.completed / submitProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-zinc-300 tabular-nums">
                    {submitProgress.completed}/{submitProgress.total}
                  </span>
                </div>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    !newTicketRows.some((r) => r.email.trim() && r.name.trim())
                  }
                  className="flex items-center justify-center gap-2"
                >
                  <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
                  Create{" "}
                  {newTicketRows.filter((r) => r.email.trim() && r.name.trim())
                    .length || 0}{" "}
                  ticket(s)
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false);
                  resetNewTicketForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filters */}
      {selectedEventId && total > 0 && visibleAffiliationStats.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {visibleAffiliationStats.map((stat) => {
            const isActive = affiliationFilter === stat.key;
            return (
              <button
                key={stat.key}
                type="button"
                onClick={() =>
                  handleAffiliationFilterChange(isActive ? "" : stat.key)
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                  isActive
                    ? "bg-rose-500/15 text-rose-300 ring-rose-500/25"
                    : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                }`}
              >
                {stat.label}
                <span
                  className={isActive ? "text-rose-300/70" : "text-zinc-500"}
                >
                  {stat.value}
                </span>
              </button>
            );
          })}
          {affiliationFilter && (
            <button
              type="button"
              onClick={() => handleAffiliationFilterChange("")}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <XMarkIcon aria-hidden="true" className="size-4 shrink-0" />
              Clear
            </button>
          )}
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 shrink-0 -translate-y-1/2 text-zinc-500"
          />
          <Input
            type="search"
            name="search"
            aria-label="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            disabled={!selectedEventId}
            className="py-2.5 pr-4 pl-10 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:w-auto">
          <Select
            aria-label="Filter by ticket type"
            name="type-filter"
            value={ticketTypeFilter}
            onChange={(e) => {
              setTicketTypeFilter(e.target.value);
              setOffset(0);
            }}
            disabled={!selectedEventId}
            className="py-2.5 sm:text-sm"
          >
            <option value="">All types</option>
            {TICKET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by scanned status"
            name="scanned-filter"
            value={scannedFilter}
            onChange={(e) => {
              setScannedFilter(e.target.value);
              setOffset(0);
            }}
            disabled={!selectedEventId}
            className="py-2.5 sm:text-sm"
          >
            <option value="">All statuses</option>
            <option value="true">Scanned</option>
            <option value="false">Not scanned</option>
          </Select>
        </div>
        {filtersActive && (
          <Button
            onClick={() => {
              setSearch("");
              setTicketTypeFilter("");
              setScannedFilter("");
              setFeeWaiverFilter("");
              setOffset(0);
              if (affiliationFilter) handleAffiliationFilterChange("");
            }}
            className="flex items-center justify-center gap-1.5 py-2.5"
          >
            <XMarkIcon aria-hidden="true" className="size-4 shrink-0" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Tickets Table */}
      {isLoading && tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-white/5">
            <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-zinc-400" />
          </div>
          <p className="text-sm text-zinc-400">Loading tickets...</p>
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          title={
            !selectedEventId
              ? "Select an event to view tickets"
              : "No tickets found"
          }
          hint={
            !selectedEventId
              ? "Choose an event from the filter above"
              : search ||
                  ticketTypeFilter ||
                  scannedFilter ||
                  feeWaiverFilter ||
                  affiliationFilter
                ? "Try adjusting your filters"
                : "Create your first ticket to get started"
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <TableScroll>
              <Table>
                <THead>
                  <TR className="border-b border-white/10">
                    <TH className="px-4 py-3.5">Name</TH>
                    <TH className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        Title
                        <button
                          type="button"
                          onClick={() => setShowTitles((prev) => !prev)}
                          className="rounded p-0.5 text-zinc-500 transition-colors hover:text-zinc-200"
                          title={
                            showTitles ? "Hide all titles" : "Show all titles"
                          }
                          aria-label={
                            showTitles ? "Hide all titles" : "Show all titles"
                          }
                        >
                          {showTitles ? (
                            <EyeSlashIcon
                              aria-hidden="true"
                              className="size-3.5 shrink-0"
                            />
                          ) : (
                            <EyeIcon
                              aria-hidden="true"
                              className="size-3.5 shrink-0"
                            />
                          )}
                        </button>
                      </span>
                    </TH>
                    <TH className="px-4 py-3.5">Email</TH>
                    <TH className="px-4 py-3.5">Type</TH>
                    <TH className="hidden px-4 py-3.5 lg:table-cell">
                      Created
                    </TH>
                    <TH className="px-4 py-3.5">Status</TH>
                    <TH className="px-4 py-3.5 text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {tickets.map((ticket) => (
                    <TR
                      key={ticket.id}
                      className="transition-colors hover:bg-white/5"
                    >
                      <TD className="max-w-[220px] px-4 py-3">
                        {renderNameCell(ticket)}
                      </TD>
                      <TD className="max-w-[220px] px-4 py-3">
                        {renderTitleCell(ticket)}
                      </TD>
                      <TD className="px-4 py-3">
                        <div className="max-w-[280px] truncate text-sm text-zinc-300">
                          {ticket.email}
                        </div>
                      </TD>
                      <TD className="px-4 py-3 whitespace-nowrap">
                        {renderTypeSelect(ticket)}
                      </TD>
                      <TD className="hidden px-4 py-3 whitespace-nowrap text-zinc-400 lg:table-cell">
                        {formatDate(ticket.created_at)}
                      </TD>
                      <TD className="px-4 py-3 whitespace-nowrap">
                        {renderScannedSelect(ticket)}
                      </TD>
                      <TD className="px-4 py-3 whitespace-nowrap">
                        <div className="flex justify-end">
                          {renderActions(ticket)}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {renderNameCell(ticket)}
                    <div className="mt-0.5">{renderTitleCell(ticket)}</div>
                    <p className="mt-0.5 truncate text-sm text-zinc-400">
                      {ticket.email}
                    </p>
                  </div>
                  <div className="shrink-0">{renderTypeSelect(ticket)}</div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  {renderScannedSelect(ticket)}
                  <span className="text-xs text-zinc-500">
                    {formatDate(ticket.created_at)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-end border-t border-white/10 pt-2">
                  {renderActions(ticket)}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {filteredCount > limit && (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:flex-row sm:px-6">
              <div className="text-sm text-zinc-400">
                Showing{" "}
                <span className="font-medium text-zinc-200">{offset + 1}</span>–
                <span className="font-medium text-zinc-200">
                  {Math.min(offset + limit, filteredCount)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-zinc-200">
                  {filteredCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= filteredCount}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmationDialog
        open={deleteModalTicket !== null}
        title="Delete Ticket"
        description={
          deleteModalTicket ? (
            <>
              Delete the ticket for{" "}
              <span className="font-semibold text-white">
                {deleteModalTicket.email}
              </span>
              {deleteModalTicket.name ? ` (${deleteModalTicket.name})` : ""}.
            </>
          ) : undefined
        }
        confirmLabel={
          isDeletingTicket ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Deleting...
            </>
          ) : (
            "Delete Ticket"
          )
        }
        tone="danger"
        dismissible={!isDeletingTicket}
        isConfirming={isDeletingTicket}
        onCancel={() => {
          if (!isDeletingTicket) {
            setDeleteModalTicket(null);
          }
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      >
        {deleteModalTicket ? (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={shouldSendCancellationEmail}
              onChange={(event) =>
                setShouldSendCancellationEmail(event.target.checked)
              }
              disabled={isDeletingTicket}
              className="size-5 shrink-0 rounded accent-rose-500 disabled:cursor-not-allowed disabled:opacity-50 sm:size-4"
            />
            <span className="text-sm text-zinc-300">
              Send cancellation email to {deleteModalTicket.email}
            </span>
          </label>
        ) : null}
      </ConfirmationDialog>
      {confirmationDialog}
    </div>
  );
}
