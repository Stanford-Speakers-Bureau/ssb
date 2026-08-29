"use client";

import { useEventContext } from "@/app/EventContext";
import TicketSalesGraph from "@/app/events/TicketSalesGraph";
import { PageHeader, EmptyState } from "@/app/components/ui";

export default function SalesClient() {
  const { events, selectedEventId } = useEventContext();
  const currentEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        title="Ticket sales"
        subtitle={
          currentEvent ? currentEvent.name || "Unnamed Event" : undefined
        }
      />

      {!selectedEventId ? (
        <EmptyState
          title="No event selected"
          hint="Select an event from the sidebar to view sales data"
        />
      ) : (
        <TicketSalesGraph eventId={selectedEventId} capacity={0} />
      )}
    </div>
  );
}
