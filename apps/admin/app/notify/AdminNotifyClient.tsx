"use client";

import { useEffect, useState } from "react";
import {
  EnvelopeIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import BulkSendProgress from "@/app/components/BulkSendProgress";
import { useConfirmationDialog } from "@/app/components/ConfirmationDialog";
import { useEventContext } from "@/app/EventContext";
import { useEventScopedFetch } from "@/app/lib/useEventScopedFetch";
import {
  BulkSendProgressState,
  getSkipBreakdownSegments,
  runChunkedSend,
} from "@/app/lib/bulkSend";
import {
  Alert,
  Button,
  EmptyState,
  Input,
  PageHeader,
  StatusPill,
  Table,
  TableScroll,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/app/components/ui";

type Notification = {
  id: string;
  email: string;
  created_at: string;
  hasTicket: boolean;
  hasProfile: boolean;
  displayName: string | null;
  affiliations: string[];
};

type EventData = {
  name: string | null;
  route: string | null;
  start_time_date: string | null;
  ticketing_date: string | null;
  ticketingOpen: boolean;
};

type NotifyResponse = {
  notifications?: Notification[];
  eventData?: EventData | null;
  error?: string;
};

/** Returns a duration from now to ticketing_date (e.g. "2 hours", "1 day"). */
function approxDurationUntil(ticketingDate: string): string {
  const d = new Date(ticketingDate);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const ms = d.getTime() - now;
  if (ms <= 0) return "a moment";
  const minutes = Math.round(ms / (60 * 1000));
  const hours = Math.round(ms / (60 * 60 * 1000));
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (minutes < 60) return minutes <= 1 ? "1 minute" : `${minutes} minutes`;
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  return days === 1 ? "1 day" : `${days} days`;
}

function formatAffiliationLabel(affiliation: string): string {
  return affiliation
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const MEMBER_OVERRIDE_AFFILIATIONS = [
  "student",
  "faculty",
  "staff",
  "affiliate",
];

function getDisplayAffiliations(affiliations: string[]): string[] {
  if (affiliations.some((a) => MEMBER_OVERRIDE_AFFILIATIONS.includes(a))) {
    return affiliations.filter((a) => a !== "member");
  }
  return affiliations;
}

const AFFILIATION_STAT_ORDER = [
  "student",
  "faculty",
  "staff",
  "postdoc",
  "alum",
  "affiliate",
  "member",
  "employee",
] as const;

const EMAIL_CHUNK_SIZE = 50;

function getBulkEmailKind(
  variant: "now" | "in" | "claim",
): "ticketsAvailableNow" | "ticketsAvailableIn" | "claimTicket" {
  if (variant === "claim") return "claimTicket";
  if (variant === "in") return "ticketsAvailableIn";
  return "ticketsAvailableNow";
}

function getVariantLabel(
  variant: "now" | "in" | "claim",
  approxTime: string,
): string {
  if (variant === "claim") return "Claim ticket emails";
  if (variant === "in") return `Tickets available in ${approxTime}`;
  return "Tickets available now emails";
}

async function fetchNotificationsForEvent(
  eventId: string,
  signal: AbortSignal,
): Promise<NotifyResponse> {
  const response = await fetch(`/api/notify?eventId=${eventId}`, { signal });

  if (!response.ok) {
    let errorMessage = "Failed to fetch notifications";
    try {
      const errorData = (await response.json()) as NotifyResponse;
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<NotifyResponse>;
}

export default function AdminNotifyClient() {
  const { events, selectedEventId } = useEventContext();
  const { confirm: confirmAction, confirmationDialog } =
    useConfirmationDialog();
  const { data, isLoading, error, refetch } =
    useEventScopedFetch<NotifyResponse>(selectedEventId, (id, signal) =>
      fetchNotificationsForEvent(id, signal),
    );
  const notifications = data?.notifications ?? [];
  const eventData = data?.eventData ?? null;
  const [searchTerm, setSearchTerm] = useState("");
  const [affiliationFilter, setAffiliationFilter] = useState<string | null>(
    null,
  );

  // Send email modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmailSingleEmail, setSendEmailSingleEmail] = useState<
    string | null
  >(null);
  const [sendVariant, setSendVariant] = useState<"now" | "in" | "claim">("now");
  const [sendApproxTime, setSendApproxTime] = useState("");
  const [isSendingNotify, setIsSendingNotify] = useState(false);
  const [sendState, setSendState] = useState<BulkSendProgressState | null>(
    null,
  );
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  useEffect(() => {
    setSendState(null);
  }, [selectedEventId]);

  function openSendEmailModal(singleEmail?: string) {
    setSendEmailSingleEmail(singleEmail ?? null);
    setSendVariant(eventData?.ticketingOpen ? "claim" : "now");
    setSendApproxTime(
      eventData?.ticketing_date
        ? approxDurationUntil(eventData.ticketing_date)
        : "",
    );
    setNotifySuccess(null);
    setNotifyError(null);
    setShowSendModal(true);
  }

  function closeSendEmailModal() {
    setShowSendModal(false);
    setSendEmailSingleEmail(null);
    setSendApproxTime("");
    setNotifyError(null);
  }

  async function handleSendNotifyEmails() {
    if (!selectedEventId) return;
    if (sendVariant === "in" && !sendApproxTime.trim()) {
      setNotifyError("Please enter when tickets will be available.");
      return;
    }
    const eventName = eventData?.name || "this event";

    const recipientEmails = [
      ...new Set(
        (sendEmailSingleEmail
          ? [sendEmailSingleEmail]
          : sendVariant === "claim"
            ? notifications
                .filter((notification) => !notification.hasTicket)
                .map((notification) => notification.email)
            : notifications.map((notification) => notification.email)
        ).map((email) => email.toLowerCase()),
      ),
    ];

    if (recipientEmails.length === 0) {
      setNotifyError(
        sendVariant === "claim"
          ? "No recipients without tickets to send to."
          : "No recipients to send to.",
      );
      return;
    }

    const variantLabel =
      sendVariant === "claim"
        ? "Claim your ticket"
        : sendVariant === "now"
          ? "Tickets available now"
          : `Tickets available in ${sendApproxTime.trim()}`;
    const recipientDescription = sendEmailSingleEmail ? (
      <>
        Send <span className="font-medium text-white">{variantLabel}</span> to{" "}
        <span className="font-medium text-white">{sendEmailSingleEmail}</span>{" "}
        for <span className="font-medium text-white">{eventName}</span>.
      </>
    ) : (
      <>
        Send <span className="font-medium text-white">{variantLabel}</span> to{" "}
        <span className="font-medium text-white">
          {recipientEmails.length.toLocaleString()}
        </span>{" "}
        {sendVariant === "claim"
          ? "people without tickets"
          : "people on the list"}{" "}
        for <span className="font-medium text-white">{eventName}</span>.
      </>
    );
    const shouldSend = await confirmAction({
      title: "Send notification email?",
      description: recipientDescription,
      confirmLabel: "Send email",
      tone: "primary",
    });
    if (!shouldSend) return;

    setIsSendingNotify(true);
    setNotifyError(null);
    setNotifySuccess(null);

    try {
      if (sendEmailSingleEmail) {
        const res = await fetch("/api/email/bulk-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedEventId,
            emails: recipientEmails,
            kind: getBulkEmailKind(sendVariant),
            ...(sendVariant === "in" && {
              approxTimeUntilAvailable: sendApproxTime.trim(),
            }),
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          sent?: number;
          failed?: number;
          skippedHasTicket?: number;
          skippedOptedOut?: number;
          suppressed?: number;
        };

        if (!res.ok) {
          throw new Error(data.error || "Failed to send emails");
        }

        if ((data.failed ?? 0) > 0) {
          setNotifyError("Failed to send email.");
        } else if ((data.skippedHasTicket ?? 0) > 0) {
          setNotifySuccess(
            "Email skipped because this person already has a ticket.",
          );
          setTimeout(closeSendEmailModal, 1500);
        } else if ((data.skippedOptedOut ?? 0) > 0) {
          setNotifySuccess(
            "Email skipped because this person opted out of these emails.",
          );
          setTimeout(closeSendEmailModal, 1500);
        } else if ((data.suppressed ?? 0) > 0) {
          setNotifySuccess("Email skipped because this address is suppressed.");
          setTimeout(closeSendEmailModal, 1500);
        } else {
          setNotifySuccess("Email sent.");
          setTimeout(closeSendEmailModal, 1500);
        }
      } else {
        setShowSendModal(false);
        const finalState = await runChunkedSend({
          items: recipientEmails,
          chunkSize: EMAIL_CHUNK_SIZE,
          label: `Sending ${getVariantLabel(sendVariant, sendApproxTime.trim())}`,
          onProgress: setSendState,
          sendChunk: async (chunk, context) => {
            const res = await fetch("/api/email/bulk-send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventId: selectedEventId,
                emails: chunk,
                auditBatchId: context.batchId,
                kind: getBulkEmailKind(sendVariant),
                ...(sendVariant === "in" && {
                  approxTimeUntilAvailable: sendApproxTime.trim(),
                }),
              }),
            });
            const data = (await res.json()) as {
              error?: string;
              sent?: number;
              failed?: number;
              skippedHasTicket?: number;
              skippedOptedOut?: number;
              suppressed?: number;
            };

            if (!res.ok) {
              throw new Error(data.error || "Failed to send emails");
            }

            return data;
          },
        });

        const skipSegments = getSkipBreakdownSegments(finalState);
        const skippedMsg =
          skipSegments.length > 0 ? `, ${skipSegments.join(", ")}` : "";
        setNotifySuccess(
          `Emails sent: ${finalState.sent} sent, ${finalState.failed} failed${skippedMsg}.`,
        );
      }
    } catch (err) {
      setNotifyError(
        err instanceof Error ? err.message : "Failed to send emails",
      );
    } finally {
      setIsSendingNotify(false);
    }
  }

  function exportToCSV() {
    const csv = [
      "Email,Affiliations,Has Profile,Has Ticket,Signup Date",
      ...notifications.map(
        (n) =>
          `${n.email},"${getDisplayAffiliations(n.affiliations).map(formatAffiliationLabel).join("; ")}",${n.hasProfile ? "Yes" : "No"},${n.hasTicket ? "Yes" : "No"},${new Date(n.created_at).toISOString()}`,
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventData?.name || "event"}-notifications.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const filtered = notifications.filter((n) => {
    const displayAffiliations = getDisplayAffiliations(n.affiliations);
    if (affiliationFilter) {
      if (affiliationFilter === "missing") {
        if (displayAffiliations.length > 0) return false;
      } else {
        if (!displayAffiliations.some((a) => a === affiliationFilter))
          return false;
      }
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      if (
        !(n.displayName?.toLowerCase().includes(lower) ?? false) &&
        !n.email.toLowerCase().includes(lower) &&
        !displayAffiliations.some(
          (affiliation) =>
            formatAffiliationLabel(affiliation).toLowerCase().includes(lower) ||
            affiliation.toLowerCase().includes(lower),
        )
      )
        return false;
    }
    return true;
  });

  const affiliationCounts = new Map<string, number>();
  let missingAffiliationCount = 0;

  for (const notification of notifications) {
    const displayAffiliations = getDisplayAffiliations(
      notification.affiliations,
    );
    if (displayAffiliations.length === 0) {
      missingAffiliationCount += 1;
      continue;
    }

    for (const affiliation of displayAffiliations) {
      affiliationCounts.set(
        affiliation,
        (affiliationCounts.get(affiliation) ?? 0) + 1,
      );
    }
  }

  const preferredAffiliationStats = AFFILIATION_STAT_ORDER.filter(
    (affiliation) => (affiliationCounts.get(affiliation) ?? 0) > 0,
  ).map((affiliation) => ({
    key: affiliation,
    label: formatAffiliationLabel(affiliation),
    value: affiliationCounts.get(affiliation) ?? 0,
  }));

  const additionalAffiliationStats = [...affiliationCounts.entries()]
    .filter(
      ([affiliation]) =>
        !AFFILIATION_STAT_ORDER.includes(
          affiliation as (typeof AFFILIATION_STAT_ORDER)[number],
        ),
    )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([affiliation, value]) => ({
      key: affiliation,
      label: formatAffiliationLabel(affiliation),
      value,
    }));

  const statCards = [
    {
      key: "total",
      label: "Total signups",
      value: notifications.length,
      tone: "text-blue-400",
    },
    {
      key: "missing",
      label: "Missing affiliation",
      value: missingAffiliationCount,
      tone: "text-amber-400",
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-8">
      <PageHeader
        title="Notification signups"
        subtitle={
          <>
            View users who signed up for event notifications.
            {selectedEventId && notifications.length > 0 && (
              <span className="text-zinc-600">
                {" "}
                · {notifications.length.toLocaleString()} signup
                {notifications.length === 1 ? "" : "s"}
              </span>
            )}
          </>
        }
        className="mb-8"
      >
        {selectedEventId && notifications.length > 0 && (
          <>
            <Button
              variant="primary"
              onClick={() => openSendEmailModal()}
              disabled={Boolean(sendState?.active)}
            >
              Send email
            </Button>
            <Button onClick={exportToCSV}>Export CSV</Button>
          </>
        )}
        <Button onClick={refetch} disabled={isLoading}>
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <Alert tone="error" className="mb-6">
          {error}
        </Alert>
      )}

      {sendState && (
        <div className="mb-6">
          <BulkSendProgress
            state={sendState}
            onDismiss={() => setSendState(null)}
          />
        </div>
      )}

      {!selectedEventId ? (
        <EmptyState
          title="No event selected"
          hint="Select an event from the sidebar to view its notification signups"
        />
      ) : isLoading ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-white/5">
            <div className="size-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-300">
            Loading notifications...
          </p>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notification signups"
          hint={`No signups for ${selectedEvent?.name || "this event"} yet`}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60">
          <div className="p-6 border-b border-white/10">
            <div className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {statCards.map((stat) => (
                  <div
                    key={stat.key}
                    className="rounded-lg bg-white/5 px-3.5 py-3 ring-1 ring-inset ring-white/10"
                  >
                    <p className="truncate text-xs font-medium tracking-wide text-zinc-400">
                      {stat.label}
                    </p>
                    <p
                      className={`mt-1 text-2xl font-bold tabular-nums ${stat.tone}`}
                    >
                      {stat.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    ...preferredAffiliationStats,
                    ...additionalAffiliationStats,
                  ].map((stat) => {
                    const isActive = affiliationFilter === stat.key;
                    return (
                      <button
                        key={stat.key}
                        type="button"
                        onClick={() =>
                          setAffiliationFilter(isActive ? null : stat.key)
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                          isActive
                            ? "bg-rose-500/15 text-rose-300 ring-rose-500/25"
                            : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                        }`}
                      >
                        {stat.label}
                        <span
                          className={
                            isActive ? "text-rose-300/70" : "text-zinc-500"
                          }
                        >
                          {stat.value}
                        </span>
                      </button>
                    );
                  })}
                  {missingAffiliationCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAffiliationFilter(
                          affiliationFilter === "missing" ? null : "missing",
                        )
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                        affiliationFilter === "missing"
                          ? "bg-rose-500/15 text-rose-300 ring-rose-500/25"
                          : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                      }`}
                    >
                      Missing
                      <span
                        className={
                          affiliationFilter === "missing"
                            ? "text-rose-300/70"
                            : "text-zinc-500"
                        }
                      >
                        {missingAffiliationCount}
                      </span>
                    </button>
                  )}
                  {affiliationFilter && (
                    <button
                      type="button"
                      onClick={() => setAffiliationFilter(null)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <XMarkIcon className="size-4 shrink-0" aria-hidden="true" />
                      Clear
                    </button>
                  )}
                </div>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 shrink-0 text-zinc-500" aria-hidden="true" />
                  <Input
                    type="text"
                    placeholder="Search name, email, or affiliation..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-3 pl-9 lg:w-72"
                  />
                </div>
              </div>
            </div>
          </div>

          <TableScroll>
            <Table>
              <THead>
                <TR className="border-b border-white/10">
                  <TH className="px-6 py-3">Name</TH>
                  <TH className="px-6 py-3">Email</TH>
                  <TH className="px-6 py-3">Affiliation</TH>
                  {eventData?.ticketingOpen && (
                    <TH className="px-6 py-3">Ticket</TH>
                  )}
                  <TH className="px-6 py-3">Signed up</TH>
                  <TH className="w-20 px-6 py-3 text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((notification) => (
                  <TR
                    key={notification.id}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <TD className="px-6 py-4 whitespace-nowrap font-medium">
                      {notification.displayName || (
                        <span className="text-zinc-600">—</span>
                      )}
                    </TD>
                    <TD className="px-6 py-4 whitespace-nowrap font-medium">
                      {notification.email}
                    </TD>
                    <TD className="px-6 py-4 text-zinc-300">
                      {(() => {
                        const displayAffiliations = getDisplayAffiliations(
                          notification.affiliations,
                        );
                        return displayAffiliations.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {displayAffiliations.map((affiliation) => (
                              <span
                                key={`${notification.id}-${affiliation}`}
                                className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-200 ring-1 ring-inset ring-white/10"
                              >
                                {formatAffiliationLabel(affiliation)}
                              </span>
                            ))}
                          </div>
                        ) : notification.hasProfile ? (
                          <span className="text-zinc-500">
                            No affiliation provided
                          </span>
                        ) : (
                          <span className="text-zinc-500">
                            Unavailable for backfilled signup
                          </span>
                        );
                      })()}
                    </TD>
                    {eventData?.ticketingOpen && (
                      <TD className="px-6 py-4 whitespace-nowrap">
                        {notification.hasTicket ? (
                          <StatusPill color="emerald" dot>
                            Has ticket
                          </StatusPill>
                        ) : (
                          <StatusPill color="amber" dot>
                            No ticket
                          </StatusPill>
                        )}
                      </TD>
                    )}
                    <TD className="px-6 py-4 whitespace-nowrap text-zinc-400">
                      {new Date(notification.created_at).toLocaleString(
                        "en-US",
                        { timeZone: "America/Los_Angeles" },
                      )}
                    </TD>
                    <TD className="px-6 py-4 whitespace-nowrap text-right">
                      {!(
                        eventData?.ticketingOpen && notification.hasTicket
                      ) && (
                        <button
                          type="button"
                          onClick={() => openSendEmailModal(notification.email)}
                          disabled={Boolean(sendState?.active)}
                          className="text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Send email to this person"
                        >
                          <EnvelopeIcon className="size-4 shrink-0 inline" aria-hidden="true" />
                        </button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        </div>
      )}

      {/* Send email modal */}
      {showSendModal &&
        (() => {
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeSendEmailModal();
              }}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-serif font-semibold text-white mb-1">
                  Send email
                </h3>
                <p className="text-zinc-500 text-sm mb-4">
                  {eventData?.name || "Event"}
                  {sendEmailSingleEmail ? (
                    <> &rarr; {sendEmailSingleEmail}</>
                  ) : (
                    <> &rarr; all {notifications.length} on list</>
                  )}
                </p>
                <div className="space-y-3 mb-4">
                  {eventData?.ticketingOpen && !sendEmailSingleEmail && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="variant"
                        checked={sendVariant === "claim"}
                        onChange={() => setSendVariant("claim")}
                        className="size-5 shrink-0 accent-rose-500 sm:size-4"
                      />
                      <div>
                        <span className="text-white">Claim your ticket</span>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Only sent to{" "}
                          {notifications.filter((n) => !n.hasTicket).length}{" "}
                          people without tickets
                        </p>
                      </div>
                    </label>
                  )}
                  {eventData?.ticketingOpen && sendEmailSingleEmail && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="variant"
                        checked={sendVariant === "claim"}
                        onChange={() => setSendVariant("claim")}
                        className="size-5 shrink-0 accent-rose-500 sm:size-4"
                      />
                      <span className="text-white">Claim your ticket</span>
                    </label>
                  )}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="variant"
                      checked={sendVariant === "now"}
                      onChange={() => setSendVariant("now")}
                      className="rounded-full border-zinc-600 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-white">Tickets available now</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="variant"
                      checked={sendVariant === "in"}
                      onChange={() => setSendVariant("in")}
                      className="rounded-full border-zinc-600 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-white">
                      Tickets available in (approx time)
                    </span>
                  </label>
                  {sendVariant === "in" && (
                    <Input
                      type="text"
                      value={sendApproxTime}
                      onChange={(e) => setSendApproxTime(e.target.value)}
                      placeholder="e.g. 2 hours, or Mon Feb 17 at 10am PT"
                      className="ml-6"
                    />
                  )}
                </div>
                {notifyError && (
                  <p className="text-rose-400 text-sm mb-3">{notifyError}</p>
                )}
                {notifySuccess && (
                  <p className="text-emerald-400 text-sm mb-3">
                    {notifySuccess}
                  </p>
                )}
                <div className="flex gap-3 justify-end">
                  <Button
                    onClick={closeSendEmailModal}
                    disabled={isSendingNotify}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSendNotifyEmails}
                    disabled={
                      isSendingNotify ||
                      (sendVariant === "in" && !sendApproxTime.trim())
                    }
                    className="flex items-center gap-2"
                  >
                    {isSendingNotify ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Send"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      {confirmationDialog}
    </div>
  );
}
