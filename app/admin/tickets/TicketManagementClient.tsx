"use client";

import { useEffect, useState } from "react";

export type Ticket = {
  id: string;
  email: string;
  type: string | null;
  created_at: string;
  scanned: boolean;
  scan_time: string | null;
  referral: string | null;
  event_id: string;
  events: {
    id: string;
    name: string | null;
    route: string | null;
    start_time_date: string | null;
  } | null;
};

type TicketManagementClientProps = {
  initialTickets: Ticket[];
  initialTotal: number;
  initialEvents: { id: string; name: string | null }[];
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default function TicketManagementClient({
  initialTickets,
  initialTotal,
  initialEvents,
}: TicketManagementClientProps) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [total, setTotal] = useState(initialTotal);

  // Calculate statistics
  const scannedCount = tickets.filter((t) => t.scanned).length;
  const unscannedCount = tickets.filter((t) => !t.scanned).length;
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [searchEmail, setSearchEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTicketEmail, setNewTicketEmail] = useState("");
  const [newTicketEventId, setNewTicketEventId] = useState("");
  const [newTicketType, setNewTicketType] = useState("VIP");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editingTicketType, setEditingTicketType] = useState<string>("");
  const [editingScannedId, setEditingScannedId] = useState<string | null>(null);
  const [editingScannedStatus, setEditingScannedStatus] = useState<boolean>(false);

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

  async function fetchTickets() {
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

      const response = await fetch(`/api/admin/tickets?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch tickets");
      }

      const data = await response.json();
      setTickets(data.tickets || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error fetching tickets:", err);
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets();
  }, [selectedEventId, offset]);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this ticket?")) return;

    try {
      const response = await fetch("/api/admin/tickets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete ticket");
      }

      setTickets((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => prev - 1);
      setSuccess("Ticket deleted successfully!");
    } catch (err) {
      console.error("Error deleting ticket:", err);
      setError(err instanceof Error ? err.message : "Failed to delete ticket");
    }
  }

  async function handleUnscan(id: string) {
    if (!confirm("Are you sure you want to unscan this ticket?")) return;

    try {
      const response = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "unscan" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to unscan ticket");
      }

      const data = await response.json();
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? (data.ticket as Ticket) : t)),
      );
      setSuccess("Ticket unscanned successfully!");
    } catch (err) {
      console.error("Error unscaning ticket:", err);
      setError(err instanceof Error ? err.message : "Failed to unscan ticket");
    }
  }

  async function handleUpdateType(id: string, newType: string) {
    try {
      const response = await fetch("/api/admin/tickets", {
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
      setEditingTicketId(null);
      setSuccess("Ticket type updated successfully!");
    } catch (err) {
      console.error("Error updating ticket type:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update ticket type",
      );
      setEditingTicketId(null);
    }
  }

  function startEditingType(ticket: Ticket) {
    setEditingTicketId(ticket.id);
    setEditingTicketType(ticket.type || "STANDARD");
  }

  function cancelEditingType() {
    setEditingTicketId(null);
    setEditingTicketType("");
  }

  async function handleUpdateScanned(id: string, newScanned: boolean) {
    try {
      const response = await fetch("/api/admin/tickets", {
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
      setEditingScannedId(null);
      setSuccess("Scanned status updated successfully!");
    } catch (err) {
      console.error("Error updating scanned status:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update scanned status",
      );
      setEditingScannedId(null);
    }
  }

  function startEditingScanned(ticket: Ticket) {
    setEditingScannedId(ticket.id);
    setEditingScannedStatus(ticket.scanned);
  }

  function cancelEditingScanned() {
    setEditingScannedId(null);
    setEditingScannedStatus(false);
  }

  async function handleAddTicket(e: React.FormEvent) {
    e.preventDefault();

    if (!newTicketEmail.trim()) {
      setError("Please enter an email address");
      return;
    }

    if (!newTicketEventId) {
      setError("Please select an event");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    // Parse comma-separated emails
    const emails = newTicketEmail
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e);

    const invalidEmails = emails.filter(
      (e) => !e.includes("@") || !e.includes("."),
    );

    if (invalidEmails.length > 0) {
      setError(`Invalid email(s): ${invalidEmails.join(", ")}`);
      setIsSubmitting(false);
      return;
    }

    let successCount = 0;
    const errors: string[] = [];
    const createdTickets: Ticket[] = [];

    // Create tickets for each email
    for (const email of emails) {
      try {
        const response = await fetch("/api/admin/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.toLowerCase(),
            eventId: newTicketEventId,
            type: newTicketType,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          errors.push(`${email}: ${data.error || "Failed to create ticket"}`);
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
    }

    if (successCount > 0) {
      setTickets((prev) => [...createdTickets, ...prev]);
      setTotal((prev) => prev + successCount);
      setSuccess(
        `Successfully created ${successCount} ticket(s)${
          errors.length > 0 ? ` (${errors.length} failed)` : ""
        }`,
      );
      setNewTicketEmail("");
      setNewTicketEventId("");
      setNewTicketType("VIP");
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

  const filteredTickets = tickets.filter((ticket) => {
    if (searchEmail) {
      return ticket.email.toLowerCase().includes(searchEmail.toLowerCase());
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white font-serif mb-2">
            Ticket Management
          </h1>
          <div className="flex items-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Total Tickets Sold:</span>
              <span className="text-white font-bold text-lg">
                {total.toLocaleString()}
              </span>
            </div>
            {tickets.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">Scanned:</span>
                  <span className="text-emerald-400 font-semibold">
                    {scannedCount}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">Not Scanned:</span>
                  <span className="text-zinc-300 font-semibold">
                    {unscannedCount}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Add VIP Ticket
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3">
          <svg
            className="w-5 h-5 text-rose-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-rose-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-rose-400 hover:text-rose-300"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
          <svg
            className="w-5 h-5 text-emerald-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <p className="text-emerald-400 text-sm">{success}</p>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto text-emerald-400 hover:text-emerald-300"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Add Ticket Form */}
      {showAddForm && (
        <div className="mb-6 bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Add VIP Ticket</h2>
          <form onSubmit={handleAddTicket} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Email
                </label>
                <input
                  type="text"
                  value={newTicketEmail}
                  onChange={(e) => setNewTicketEmail(e.target.value)}
                  placeholder="user@example.com or user1@example.com, user2@example.com"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                  required
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Enter a single email or multiple emails separated by commas
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Event
                </label>
                <select
                  value={newTicketEventId}
                  onChange={(e) => setNewTicketEventId(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                  required
                >
                  <option value="">Select an event</option>
                  {initialEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name || "Unnamed Event"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Ticket Type
                </label>
                <select
                  value={newTicketType}
                  onChange={(e) => setNewTicketType(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="VIP">VIP</option>
                  <option value="STANDARD">STANDARD</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 pt-4 border-t border-zinc-800">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                Create Ticket
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewTicketEmail("");
                  setNewTicketEventId("");
                  setNewTicketType("VIP");
                }}
                className="px-6 py-3 text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Filter by Event
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setOffset(0);
            }}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
          >
            <option value="">All Events</option>
            {initialEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name || "Unnamed Event"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Search by Email
          </label>
          <input
            type="text"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="Search email..."
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      {/* Tickets Table */}
      {isLoading && tickets.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          </div>
          <p className="text-zinc-400">Loading tickets...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 002 2h3a2 2 0 002-2V7a2 2 0 00-2-2H5zM5 13a2 2 0 00-2 2v3a2 2 0 002 2h3a2 2 0 002-2v-3a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2v-3z"
              />
            </svg>
          </div>
          <p className="text-zinc-400 text-lg mb-2">No tickets found</p>
          <p className="text-zinc-600 text-sm">
            {searchEmail || selectedEventId
              ? "Try adjusting your filters"
              : "Create your first ticket to get started"}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-800/50 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {ticket.events?.name || "Unknown Event"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-300">
                        {ticket.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingTicketId === ticket.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editingTicketType}
                            onChange={(e) => setEditingTicketType(e.target.value)}
                            onBlur={() => {
                              if (editingTicketType !== ticket.type) {
                                handleUpdateType(ticket.id, editingTicketType);
                              } else {
                                cancelEditingType();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingTicketType !== ticket.type) {
                                  handleUpdateType(ticket.id, editingTicketType);
                                } else {
                                  cancelEditingType();
                                }
                              } else if (e.key === "Escape") {
                                cancelEditingType();
                              }
                            }}
                            autoFocus
                            className="px-2 py-1 text-xs font-medium rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                          >
                            <option value="VIP">VIP</option>
                            <option value="STANDARD">STANDARD</option>
                          </select>
                          <button
                            onClick={() => {
                              if (editingTicketType !== ticket.type) {
                                handleUpdateType(ticket.id, editingTicketType);
                              } else {
                                cancelEditingType();
                              }
                            }}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Save"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={cancelEditingType}
                            className="text-zinc-400 hover:text-zinc-300 transition-colors"
                            title="Cancel"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingType(ticket)}
                          className="group"
                          title="Click to edit type"
                        >
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                              ticket.type === "VIP"
                                ? "bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30"
                                : "bg-zinc-700 text-zinc-300 group-hover:bg-zinc-600"
                            }`}
                          >
                            {ticket.type || "STANDARD"}
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-400">
                        {formatDate(ticket.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingScannedId === ticket.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editingScannedStatus ? "scanned" : "not-scanned"}
                            onChange={(e) =>
                              setEditingScannedStatus(e.target.value === "scanned")
                            }
                            onBlur={() => {
                              if (editingScannedStatus !== ticket.scanned) {
                                handleUpdateScanned(ticket.id, editingScannedStatus);
                              } else {
                                cancelEditingScanned();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (editingScannedStatus !== ticket.scanned) {
                                  handleUpdateScanned(ticket.id, editingScannedStatus);
                                } else {
                                  cancelEditingScanned();
                                }
                              } else if (e.key === "Escape") {
                                cancelEditingScanned();
                              }
                            }}
                            autoFocus
                            className="px-2 py-1 text-xs font-medium rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                          >
                            <option value="scanned">Scanned</option>
                            <option value="not-scanned">Not Scanned</option>
                          </select>
                          <button
                            onClick={() => {
                              if (editingScannedStatus !== ticket.scanned) {
                                handleUpdateScanned(ticket.id, editingScannedStatus);
                              } else {
                                cancelEditingScanned();
                              }
                            }}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Save"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={cancelEditingScanned}
                            className="text-zinc-400 hover:text-zinc-300 transition-colors"
                            title="Cancel"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingScanned(ticket)}
                          className="group"
                          title="Click to edit status"
                        >
                          {ticket.scanned ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30 transition-colors">
                              <svg
                                className="w-3 h-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Scanned
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-zinc-700 text-zinc-300 group-hover:bg-zinc-600 transition-colors">
                              Not Scanned
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(ticket.id)}
                          className="text-rose-400 hover:text-rose-300 transition-colors"
                          title="Delete ticket"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-sm text-zinc-400">
                Showing {offset + 1} to {Math.min(offset + limit, total)} of{" "}
                {total} tickets
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
