"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { getNextEventId } from "@/app/lib/eventUtils";
import { sortByStartDate } from "@/app/lib/formatting";

export type EventOption = {
  id: string;
  name: string | null;
  start_time_date: string | null;
  standbyEnabled: boolean;
  live: boolean;
  tagline?: string | null;
  imgVersion?: number | null;
  doors_open?: string | null;
  venue?: string | null;
  venue_link?: string | null;
  route?: string | null;
  questionsEnabled?: boolean;
  questionsRankingsHidden?: boolean;
  identityVerificationEnabled?: boolean;
  allowAdmittingStandby?: boolean;
};

type EventContextType = {
  events: EventOption[];
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
  updateEvent: (id: string, updates: Partial<EventOption>) => void;
  upsertEvent: (event: EventOption) => void;
  removeEvent: (id: string) => void;
};

const EventContext = createContext<EventContextType | null>(null);

const sortEvents = sortByStartDate<EventOption>;

export function EventProvider({
  events: initialEvents,
  defaultEventId,
  children,
}: {
  events: EventOption[];
  defaultEventId: string;
  children: React.ReactNode;
}) {
  const [requestedSelectedEventId, setRequestedSelectedEventId] =
    useState(defaultEventId);
  const [eventPatches, setEventPatches] = useState<
    Record<string, Partial<EventOption>>
  >({});
  const [createdEvents, setCreatedEvents] = useState<
    Record<string, EventOption>
  >({});
  const [removedEventIds, setRemovedEventIds] = useState<Record<string, true>>(
    {},
  );

  const events = useMemo(() => {
    const nextEvents = new Map<string, EventOption>();

    initialEvents.forEach((event) => {
      if (removedEventIds[event.id]) return;
      nextEvents.set(event.id, { ...event, ...(eventPatches[event.id] ?? {}) });
    });

    Object.values(createdEvents).forEach((event) => {
      if (removedEventIds[event.id]) return;
      if (nextEvents.has(event.id)) return;
      nextEvents.set(event.id, event);
    });

    return sortEvents(Array.from(nextEvents.values()));
  }, [createdEvents, eventPatches, initialEvents, removedEventIds]);

  const selectedEventId = useMemo(() => {
    if (
      requestedSelectedEventId &&
      events.some((event) => event.id === requestedSelectedEventId)
    ) {
      return requestedSelectedEventId;
    }

    return getNextEventId(events);
  }, [events, requestedSelectedEventId]);

  function clearRemovedEventId(id: string) {
    setRemovedEventIds((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const setSelectedEventId = useCallback((id: string) => {
    setRequestedSelectedEventId(id);
  }, []);

  function updateEvent(id: string, updates: Partial<EventOption>) {
    clearRemovedEventId(id);

    if (createdEvents[id]) {
      setCreatedEvents((prev) => ({
        ...prev,
        [id]: { ...prev[id]!, ...updates },
      }));
      return;
    }

    setEventPatches((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), ...updates },
    }));
  }

  function upsertEvent(event: EventOption) {
    clearRemovedEventId(event.id);

    if (initialEvents.some((initialEvent) => initialEvent.id === event.id)) {
      setEventPatches((prev) => ({ ...prev, [event.id]: event }));
      setCreatedEvents((prev) => {
        if (!prev[event.id]) return prev;
        const next = { ...prev };
        delete next[event.id];
        return next;
      });
      return;
    }

    setCreatedEvents((prev) => ({ ...prev, [event.id]: event }));
  }

  function removeEvent(id: string) {
    setRemovedEventIds((prev) => ({ ...prev, [id]: true }));
    setEventPatches((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCreatedEvents((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return (
    <EventContext.Provider
      value={{
        events,
        selectedEventId,
        setSelectedEventId,
        updateEvent,
        upsertEvent,
        removeEvent,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEventContext() {
  const ctx = useContext(EventContext);
  if (!ctx)
    throw new Error("useEventContext must be used within EventProvider");
  return ctx;
}
