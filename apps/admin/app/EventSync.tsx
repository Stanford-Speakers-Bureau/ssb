"use client";

import { useEffect } from "react";
import { useEventContext } from "@/app/EventContext";

export function EventSync({ eventId }: { eventId: string }) {
  const { setSelectedEventId } = useEventContext();
  useEffect(() => {
    setSelectedEventId(eventId);
  }, [eventId, setSelectedEventId]);
  return null;
}
