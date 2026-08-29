"use client";

import { useEffect, useState } from "react";
import { ConfirmationDialog } from "@/app/components/ConfirmationDialog";
import BulkSendProgress from "@/app/components/BulkSendProgress";
import {
  PACIFIC_TIMEZONE,
  REMINDER_EMAIL_BATCH_SIZE,
} from "@/app/lib/constants";
import { BulkSendProgressState, runChunkedSend } from "@/app/lib/bulkSend";
import { useEventContext } from "@/app/EventContext";
import { useEventScopedFetch } from "@/app/lib/useEventScopedFetch";
import {
  Alert,
  Button,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  Toggle,
  TR,
} from "@/app/components/ui";

type WaitlistEntry = {
  id: string;
  email: string;
  name: string | null;
  referral: string | null;
  position: number;
  created_at: string;
};

type StandbyTicket = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
};

type WaitlistResponse = {
  event?: {
    id: string;
    name: string | null;
    capacity: number;
    reserved: number | null;
    standbyMode: boolean;
  };
  waitlist?: WaitlistEntry[];
};

type StandbyTicketsResponse = {
  tickets?: StandbyTicket[];
  total?: number;
};

type WaitlistData = {
  waitlist: WaitlistEntry[];
  standbyTickets: StandbyTicket[];
  ticketsStillAvailable: boolean;
};

function formatDisplayDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default function WaitlistViewerClient() {
  const { events, selectedEventId, updateEvent } = useEventContext();
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showStandbyConfirm, setShowStandbyConfirm] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [bulkStandbyState, setBulkStandbyState] =
    useState<BulkSendProgressState | null>(null);
  const [isTogglingStandby, setIsTogglingStandby] = useState(false);
  const [isConvertingStandby, setIsConvertingStandby] = useState(false);
  const [standbyOpenTime, setStandbyOpenTime] = useState("7:30 PM");
  const [expectedCapacity, setExpectedCapacity] = useState("100-200");
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const isStandbyMode = selectedEvent?.standbyEnabled ?? false;

  const { data, isLoading, error, refetch } = useEventScopedFetch<WaitlistData>(
    selectedEventId,
    async (id, signal) => {
      // Fetch waitlist entries and standby tickets in parallel.
      const [waitlistRes, standbyRes] = await Promise.all([
        fetch(`/api/waitlist?eventId=${id}`, { signal }),
        fetch(`/api/tickets?eventId=${id}&type=STANDBY&limit=1000`, { signal }),
      ]);

      if (!waitlistRes.ok) {
        let errorMessage = "Failed to fetch waitlist";
        try {
          const errorData = await waitlistRes.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${waitlistRes.status}: ${waitlistRes.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const contentType = waitlistRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format from server");
      }

      const waitlistData = (await waitlistRes.json()) as WaitlistResponse;
      const standbyData = standbyRes.ok
        ? ((await standbyRes.json()) as StandbyTicketsResponse)
        : null;

      // total from the standby response is the unfiltered ticket count.
      const eventData = waitlistData.event;
      let ticketsStillAvailable = false;
      if (eventData && standbyData) {
        const maxPublic = Math.max(
          0,
          (eventData.capacity || 0) - (eventData.reserved || 0),
        );
        const totalTickets = standbyData.total ?? 0;
        ticketsStillAvailable =
          !eventData.standbyMode && totalTickets < maxPublic;
      }

      return {
        waitlist: waitlistData.waitlist || [],
        standbyTickets: standbyData?.tickets || [],
        ticketsStillAvailable,
      };
    },
  );

  const waitlist = data?.waitlist ?? [];
  const standbyTickets = data?.standbyTickets ?? [];
  const ticketsStillAvailable = data?.ticketsStillAvailable ?? false;

  // Clear any lingering bulk-send progress when switching events.
  useEffect(() => {
    setBulkStandbyState(null);
  }, [selectedEventId]);

  function handleRefresh() {
    refetch();
  }

  async function handleToggleStandby(enable: boolean): Promise<boolean> {
    if (!selectedEventId) return false;

    setIsTogglingStandby(true);
    setNotifyError(null);
    setNotifySuccess(null);

    try {
      const response = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedEventId, standbyEnabled: enable }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to toggle standby mode";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      updateEvent(selectedEventId, { standbyEnabled: enable });
      setNotifySuccess(
        enable ? "Standby line enabled." : "Standby line disabled.",
      );
      return true;
    } catch (err) {
      console.error("Error toggling standby mode:", err);
      setNotifyError(
        err instanceof Error ? err.message : "Failed to toggle standby mode",
      );
      return false;
    } finally {
      setIsTogglingStandby(false);
      setShowStandbyConfirm(false);
      setShowDisableDialog(false);
    }
  }

  // When standby is turned off, optionally migrate the existing standby tickets
  // first (to regular tickets or back to the waitlist), then disable standby.
  async function handleConvertAndDisable(mode: "regular" | "waitlist") {
    if (!selectedEventId) return;

    setIsConvertingStandby(true);
    setNotifyError(null);
    setNotifySuccess(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert_standby",
          eventId: selectedEventId,
          mode,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to convert standby tickets";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const disabled = await handleToggleStandby(false);

      if (disabled) {
        const destination =
          mode === "regular" ? "regular tickets" : "the waitlist";
        setNotifySuccess(
          `Converted ${result.converted} standby ticket${result.converted !== 1 ? "s" : ""} to ${destination}${result.errors > 0 ? ` (${result.errors} failed)` : ""}. Standby line disabled.`,
        );
      }
      refetch();
    } catch (err) {
      console.error("Error converting standby tickets:", err);
      setNotifyError(
        err instanceof Error
          ? err.message
          : "Failed to convert standby tickets",
      );
    } finally {
      setIsConvertingStandby(false);
      setShowDisableDialog(false);
    }
  }

  async function handleSendStandbyEmails() {
    if (!selectedEventId) {
      setNotifyError("Please select an event first");
      return;
    }

    if (waitlist.length === 0) {
      setNotifyError("No waitlist entries found for this event");
      return;
    }

    setIsSendingEmails(true);
    setNotifyError(null);
    setNotifySuccess(null);
    setShowSendDialog(false);

    try {
      // Issue standby tickets through the shared bulk-send system: chunk the
      // waitlist and post one chunk per request, tracking categorized progress.
      const finalState = await runChunkedSend({
        items: waitlist,
        chunkSize: REMINDER_EMAIL_BATCH_SIZE,
        label: "Sending standby emails",
        onProgress: setBulkStandbyState,
        sendChunk: async (chunk, context) => {
          const response = await fetch("/api/waitlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "sendStandbyEmails",
              eventId: selectedEventId,
              auditBatchId: context.batchId,
              waitlistIds: chunk.map((entry) => entry.id),
              waitlistOpenTime: standbyOpenTime,
              expectedCapacity,
            }),
          });

          const data = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(data?.error || "Failed to send standby emails");
          }
          return data;
        },
      });

      const detailParts: string[] = [];
      if (finalState.failed > 0) detailParts.push(`${finalState.failed} failed`);
      if (finalState.skippedHasTicket > 0)
        detailParts.push(`${finalState.skippedHasTicket} already had a ticket`);
      if (finalState.suppressed > 0)
        detailParts.push(`${finalState.suppressed} suppressed`);
      const detail = detailParts.length > 0 ? ` (${detailParts.join(", ")})` : "";

      setNotifySuccess(
        `Sent ${finalState.sent} standby email${finalState.sent !== 1 ? "s" : ""}${detail}.`,
      );
      refetch();
    } catch (err) {
      console.error("Error sending standby emails:", err);
      setNotifyError(
        err instanceof Error ? err.message : "Failed to send emails",
      );
    } finally {
      setIsSendingEmails(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <PageHeader
        className="mb-8"
        title="Waitlist Management"
        subtitle="View and manage event waitlist entries"
      >
        {selectedEventId && (
          <>
            {/* Standby Line Toggle */}
            <Toggle
              checked={isStandbyMode}
              disabled={isTogglingStandby}
              onChange={() => {
                if (isStandbyMode) {
                  // Ask how to handle existing standby tickets; if there are
                  // none, there's nothing to migrate, so just turn it off.
                  if (standbyTickets.length > 0) {
                    setShowDisableDialog(true);
                  } else {
                    void handleToggleStandby(false);
                  }
                } else {
                  setShowStandbyConfirm(true);
                }
              }}
              label="Standby Line"
            />

            {/* Send Standby Emails — only when standby is ON and entries exist */}
            {isStandbyMode && waitlist.length > 0 && (
              <Button
                variant="primary"
                onClick={() => setShowSendDialog(true)}
                disabled={isLoading || isSendingEmails}
              >
                Send Standby Emails
              </Button>
            )}
          </>
        )}
        <Button onClick={handleRefresh} disabled={isLoading}>
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <Alert tone="error" className="mb-6">
          {error}
        </Alert>
      )}

      {notifySuccess && (
        <Alert tone="success" className="mb-6">
          {notifySuccess}
        </Alert>
      )}

      {notifyError && (
        <Alert tone="error" className="mb-6">
          {notifyError}
        </Alert>
      )}

      {bulkStandbyState && (
        <div className="mb-6">
          <BulkSendProgress
            state={bulkStandbyState}
            onDismiss={() => setBulkStandbyState(null)}
          />
        </div>
      )}

      {isStandbyMode && ticketsStillAvailable && selectedEventId && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-amber-500/10 p-3.5 ring-1 ring-inset ring-amber-500/25">
          <p className="flex-1 text-sm text-amber-300">
            Standby line is active but regular tickets are still available.
            Users can still get standard tickets.
          </p>
        </div>
      )}

      {!selectedEventId ? (
        <EmptyState
          title="No event selected"
          hint="Select an event from the sidebar to view its waitlist"
        />
      ) : isLoading ? (
        <EmptyState title="Loading waitlist…" />
      ) : waitlist.length === 0 ? (
        <EmptyState
          title="No waitlist entries"
          hint={`No waitlist entries for ${selectedEvent?.name || "this event"}`}
        />
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-4 text-sm text-zinc-400">
            <span>
              Total entries:{" "}
              <span className="font-semibold text-emerald-400 tabular-nums">
                {waitlist.length}
              </span>
            </span>
            {selectedEvent && (
              <span className="font-medium text-white">
                {selectedEvent.name || "Unnamed Event"}
              </span>
            )}
          </div>

          <TableScroll>
            <Table>
              <THead>
                <TR className="border-b border-white/10">
                  <TH>Position</TH>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Referral</TH>
                  <TH>Joined</TH>
                </TR>
              </THead>
              <TBody>
                {waitlist.map((entry, index) => (
                  <TR key={entry.id}>
                    <TD>
                      <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white tabular-nums">
                        {index + 1}
                      </span>
                    </TD>
                    <TD>{entry.name || "\u2014"}</TD>
                    <TD className="font-medium">{entry.email}</TD>
                    <TD className="text-zinc-400">
                      {entry.referral || "\u2014"}
                    </TD>
                    <TD className="text-zinc-400">
                      {formatDisplayDate(entry.created_at)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        </div>
      )}

      {/* Standby Tickets Table */}
      {isStandbyMode && standbyTickets.length > 0 && selectedEventId && (
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-4 text-sm text-zinc-400">
            <span>
              Standby tickets:{" "}
              <span className="font-semibold text-amber-400 tabular-nums">
                {standbyTickets.length}
              </span>
            </span>
          </div>

          <TableScroll>
            <Table>
              <THead>
                <TR className="border-b border-white/10">
                  <TH>#</TH>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Issued</TH>
                </TR>
              </THead>
              <TBody>
                {standbyTickets.map((ticket, index) => (
                  <TR key={ticket.id}>
                    <TD>
                      <span className="inline-flex size-9 items-center justify-center rounded-full bg-amber-500/15 text-sm font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/25 tabular-nums">
                        {index + 1}
                      </span>
                    </TD>
                    <TD>{ticket.name || "\u2014"}</TD>
                    <TD className="font-medium">{ticket.email}</TD>
                    <TD className="text-zinc-400">
                      {formatDisplayDate(ticket.created_at)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        </div>
      )}

      <ConfirmationDialog
        open={showStandbyConfirm}
        title="Enable Standby Line?"
        tone={ticketsStillAvailable ? "danger" : "primary"}
        description={
          ticketsStillAvailable ? (
            <>
              <p>
                Regular tickets are still available for this event. Enabling
                standby now will likely reduce turnout — people will line up for
                standby instead of claiming the open tickets. Are you sure?
              </p>
              <p className="mt-2">
                This also closes the online waitlist and shows the standby
                ticket option on the event page.
              </p>
            </>
          ) : (
            "This closes the online waitlist and shows the standby ticket option on the event page."
          )
        }
        confirmLabel={
          isTogglingStandby ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Enabling...
            </>
          ) : (
            "Enable"
          )
        }
        dismissible={!isTogglingStandby}
        isConfirming={isTogglingStandby}
        onCancel={() => setShowStandbyConfirm(false)}
        onConfirm={() => {
          void handleToggleStandby(true);
        }}
      />

      {/* Disable Standby — choose what happens to existing standby tickets */}
      {showDisableDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="mb-2 text-sm font-semibold text-white">
              Disable Standby Line
            </h2>
            <p className="mb-5 text-sm text-zinc-400">
              This event has{" "}
              <span className="font-semibold text-amber-400">
                {standbyTickets.length}
              </span>{" "}
              standby ticket{standbyTickets.length !== 1 ? "s" : ""}. Choose what
              happens to them when standby turns off.
            </p>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => void handleConvertAndDisable("regular")}
                disabled={isConvertingStandby || isTogglingStandby}
                className="block w-full rounded-lg bg-white/5 px-4 py-3 text-left ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block text-sm font-semibold text-white">
                  Convert to regular tickets
                </span>
                <span className="mt-0.5 block text-xs text-zinc-400">
                  Upgrade everyone to a guaranteed ticket and email them a
                  confirmation.
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleConvertAndDisable("waitlist")}
                disabled={isConvertingStandby || isTogglingStandby}
                className="block w-full rounded-lg bg-white/5 px-4 py-3 text-left ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block text-sm font-semibold text-white">
                  Move back to waitlist
                </span>
                <span className="mt-0.5 block text-xs text-zinc-400">
                  Return them to the waitlist (no email). Their standby ticket is
                  voided.
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleToggleStandby(false)}
                disabled={isConvertingStandby || isTogglingStandby}
                className="block w-full rounded-lg bg-white/5 px-4 py-3 text-left ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block text-sm font-semibold text-white">
                  Just disable
                </span>
                <span className="mt-0.5 block text-xs text-zinc-400">
                  Turn standby off but leave the existing standby tickets
                  unchanged.
                </span>
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                onClick={() => setShowDisableDialog(false)}
                disabled={isConvertingStandby || isTogglingStandby}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Send Standby Emails Dialog */}
      {showSendDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="mb-4 text-sm font-semibold text-white">
              Send Standby Emails
            </h2>
            <p className="mb-6 text-sm text-zinc-400">
              This will send standby line emails to all waitlist entries for the
              selected event, converting them to standby tickets.
            </p>
            <div className="mb-6 space-y-4">
              <div>
                <Label htmlFor="standby-open-time" className="mb-1.5 block">
                  Standby line open time
                </Label>
                <Input
                  id="standby-open-time"
                  type="text"
                  value={standbyOpenTime}
                  onChange={(e) => setStandbyOpenTime(e.target.value)}
                  placeholder="7:30 PM"
                />
              </div>
              <div>
                <Label htmlFor="expected-capacity" className="mb-1.5 block">
                  Expected capacity
                </Label>
                <Input
                  id="expected-capacity"
                  type="text"
                  value={expectedCapacity}
                  onChange={(e) => setExpectedCapacity(e.target.value)}
                  placeholder="100-200"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  setShowSendDialog(false);
                  setNotifyError(null);
                  setNotifySuccess(null);
                }}
                disabled={isSendingEmails}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSendStandbyEmails()}
                disabled={isSendingEmails}
                className="flex-1"
              >
                {isSendingEmails ? "Sending…" : "Send Emails"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
