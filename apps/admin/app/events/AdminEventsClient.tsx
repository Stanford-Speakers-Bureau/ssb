"use client";

import { useEffect, useState } from "react";
import {
  MagnifyingGlassIcon,
  PencilIcon,
  PhotoIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useConfirmationDialog } from "@/app/components/ConfirmationDialog";
import { PACIFIC_TIMEZONE } from "@/app/lib/constants";
import { useEventContext } from "@/app/EventContext";
import type { TicketingRole } from "@/app/lib/ticketingRoles";
import {
  Alert,
  EmptyState,
  Input,
  PageHeader,
  StatusPill,
  type SemanticColor,
} from "@/app/components/ui";

export type Event = {
  id: string;
  created_at: string;
  name: string | null;
  desc: string | null;
  tagline: string | null;
  img: string | null;
  mobile_img: string | null;
  apple_wallet_img: string | null;
  img_version: number | null;
  capacity: number;
  tickets?: number | null;
  venue: string | null;
  reserved: number | null;
  venue_link: string | null;
  release_date: string | null;
  ticketing_date?: string | null;
  start_time_date: string | null;
  end_time_date: string | null;
  doors_open: string | null;
  route: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  image_url?: string | null;
  mobile_image_url?: string | null;
  apple_wallet_image_url?: string | null;
  live?: boolean | null;
  priority?: string | null;
  hide_ticketing_date?: boolean;
  livestream?: string | null;
  referrals_enabled?: boolean;
  standby_enabled?: boolean | null;
  ticketing_roles?: TicketingRole[];
  external_ticketing_enabled?: boolean;
  external_ticketing_url?: string | null;
  banner_eligible?: boolean;
  identity_verification_enabled?: boolean;
  allow_admitting_standby?: boolean;
  tickets_sold?: number;
  waitlist_count?: number;
  standby_count?: number;
};

type EventStatus = {
  label: string;
  color: SemanticColor;
};

function formatShortDate(dateString: string | null): {
  date: string;
  time: string;
} {
  if (!dateString) return { date: "TBD", time: "" };
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return { date: "TBD", time: "" };

  return {
    date: new Intl.DateTimeFormat("en-US", {
      timeZone: PACIFIC_TIMEZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-US", {
      timeZone: PACIFIC_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date),
  };
}

function getEventStatus(event: Event): EventStatus {
  const now = new Date();

  // Mystery event: no name and release_date in future
  const isMystery =
    !event.name && event.release_date && new Date(event.release_date) > now;

  const eventStart = event.start_time_date
    ? new Date(event.start_time_date)
    : null;
  const eventEnd = event.end_time_date
    ? new Date(event.end_time_date)
    : eventStart
      ? new Date(eventStart.getTime() + 6 * 60 * 60 * 1000)
      : null;

  if (eventEnd && now >= eventEnd) {
    return { label: "Event Over", color: "zinc" };
  }

  if (event.live) {
    return { label: "Happening Now", color: "emerald" };
  }

  if (eventStart && now >= eventStart) {
    return { label: "Event Started", color: "emerald" };
  }

  if (event.standby_enabled) {
    return { label: "Standby Line Open", color: "amber" };
  }

  if (isMystery) {
    return { label: "Mystery Speaker", color: "violet" };
  }

  const maxPublic = Math.max(0, event.capacity - (event.reserved || 0));
  const isSoldOut =
    event.capacity > 0 && (event.tickets_sold || 0) >= maxPublic;

  if (isSoldOut) {
    return { label: "Sold Out", color: "rose" };
  }

  const ticketingDate = event.ticketing_date
    ? new Date(event.ticketing_date)
    : null;
  if (ticketingDate && now < ticketingDate) {
    if (event.hide_ticketing_date) {
      return { label: "Tickets Drop (Hidden)", color: "blue" };
    }
    const formatted = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: PACIFIC_TIMEZONE,
    }).format(ticketingDate);
    return { label: `Tickets Drop ${formatted}`, color: "blue" };
  }

  return { label: "Tickets Available", color: "emerald" };
}

type EventThumbnailProps = {
  event: Event;
};

function EventThumbnail({ event }: EventThumbnailProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-white/5">
      {!event.image_url ? (
        <div className="flex size-full items-center justify-center">
          <PhotoIcon aria-hidden="true" className="size-4 shrink-0 text-zinc-600" />
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 animate-pulse bg-zinc-800" />
          )}
          <Image
            src={event.image_url}
            alt={event.name || "Event"}
            fill
            sizes="48px"
            className={`object-cover transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
            onLoad={() => setIsLoading(false)}
            unoptimized
          />
        </>
      )}
    </div>
  );
}

function StatusBadge({ event }: { event: Event }) {
  const status = getEventStatus(event);
  return (
    <StatusPill color={status.color} dot className="whitespace-nowrap">
      {status.label}
    </StatusPill>
  );
}

function CapacityMeter({ event }: { event: Event }) {
  const sold = event.tickets_sold ?? 0;
  const capacity = event.capacity || 0;
  const pct =
    capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
  const isFull = capacity > 0 && sold >= capacity;

  return (
    <div className="w-32">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-zinc-300 tabular-nums">
          {sold}
          <span className="text-zinc-600">/{capacity}</span>
        </span>
        {(event.standby_count ?? 0) > 0 && (
          <span className="text-amber-400/80 tabular-nums">
            +{event.standby_count}
          </span>
        )}
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full w-(--fill) rounded-full ${isFull ? "bg-orange-400" : "bg-emerald-500"}`}
          style={{ "--fill": `${pct}%` } as Record<string, string>}
        />
      </div>
    </div>
  );
}

type AdminEventsClientProps = {
  initialEvents: Event[];
};

export default function AdminEventsClient({
  initialEvents,
}: AdminEventsClientProps) {
  const router = useRouter();
  const { setSelectedEventId, removeEvent } = useEventContext();
  const { confirm: confirmAction, confirmationDialog } =
    useConfirmationDialog();
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const filteredEvents = events.filter((event) => {
    if (!query.trim()) return true;
    const haystack = `${event.name ?? "Mystery Speaker"} ${event.venue ?? ""} ${event.tagline ?? ""}`;
    return haystack.toLowerCase().includes(query.trim().toLowerCase());
  });

  async function handleDelete(id: string) {
    const shouldDelete = await confirmAction({
      title: "Delete this event?",
      description:
        "This permanently removes the event from the admin dashboard.",
      confirmLabel: "Delete event",
      tone: "danger",
    });
    if (!shouldDelete) return;

    try {
      const response = await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        removeEvent(id);
        setSuccess("Event deleted successfully!");
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete event");
      }
    } catch (err) {
      console.error("Failed to delete event:", err);
      setError("Failed to delete event. Please try again.");
    }
  }

  function handleSelectAndEdit(event: Event) {
    setSelectedEventId(event.id);
    router.push(`/events/edit/${event.id}`);
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <PageHeader
        className="mb-6"
        title="Event management"
        subtitle={
          <>
            View and manage speaker events.
            {events.length > 0 && (
              <span className="text-zinc-600"> · {events.length} total</span>
            )}
          </>
        }
      >
        <Link
          href="/events/edit?create=1"
          className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
        >
          Create event
        </Link>
      </PageHeader>

      {error && (
        <Alert className="mb-6" tone="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          className="mb-6"
          tone="success"
          onDismiss={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          hint="Create your first speaker event to get started."
        >
          <Link
            href="/events/edit?create=1"
            className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
          >
            Create event
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 relative max-w-sm">
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 shrink-0 -translate-y-1/2 text-zinc-500"
            />
            <Input
              type="text"
              aria-label="Search events"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or venue…"
              className="pr-3 pl-9"
            />
          </div>

          {filteredEvents.length === 0 ? (
            <EmptyState title={<>No events match &ldquo;{query}&rdquo;.</>} />
          ) : (
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6">
              <div className="inline-block min-w-full px-4 py-2 align-middle sm:px-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-sm font-medium text-zinc-400">
                      <th className="py-3 pr-4 font-medium whitespace-nowrap">
                        Event
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Date
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">
                        Tickets
                      </th>
                      <th className="py-3 pl-4 text-right font-medium whitespace-nowrap">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => {
                      const { date, time } = formatShortDate(
                        event.start_time_date,
                      );
                      return (
                        <tr
                          key={event.id}
                          className="group border-b border-white/10 transition-colors hover:bg-white/[0.02]"
                        >
                          <td className="py-3 pr-4">
                            <button
                              onClick={() => handleSelectAndEdit(event)}
                              className="flex items-center gap-3 text-left"
                            >
                              <EventThumbnail event={event} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium text-white group-hover:text-rose-400 transition-colors">
                                    {event.name || "Mystery Speaker"}
                                  </span>
                                  {event.live && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 py-0.5 pr-2 pl-1.5 text-xs font-medium text-rose-300 ring-1 ring-inset ring-rose-500/25">
                                      <span className="size-1.5 animate-pulse rounded-full bg-rose-400" />
                                      LIVE
                                    </span>
                                  )}
                                </div>
                                {event.venue && (
                                  <p className="truncate text-xs text-zinc-500">
                                    {event.venue}
                                  </p>
                                )}
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-zinc-300">{date}</div>
                            {time && (
                              <div className="text-xs text-zinc-500">
                                {time}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge event={event} />
                          </td>
                          <td className="px-4 py-3">
                            <CapacityMeter event={event} />
                          </td>
                          <td className="py-3 pl-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleSelectAndEdit(event)}
                                className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                                title="Edit event"
                              >
                                <PencilIcon aria-hidden="true" className="size-4 shrink-0" />
                              </button>
                              <button
                                onClick={() => handleDelete(event.id)}
                                className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-rose-400"
                                title="Delete event"
                              >
                                <TrashIcon aria-hidden="true" className="size-4 shrink-0" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      {confirmationDialog}
    </div>
  );
}
