import { EVENT_END_FALLBACK_MS } from "./constants";

function parseEventDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

export function getEventEndDate({
  endTime,
  startTime,
  fallbackDurationMs = EVENT_END_FALLBACK_MS,
}: {
  endTime?: string | Date | null;
  startTime?: string | Date | null;
  fallbackDurationMs?: number;
}): Date | null {
  const explicitEnd = parseEventDate(endTime);
  if (explicitEnd) return explicitEnd;

  const start = parseEventDate(startTime);
  if (!start) return null;

  return new Date(start.getTime() + fallbackDurationMs);
}

export function isEventOver({
  endTime,
  startTime,
  fallbackDurationMs,
  now = new Date(),
}: {
  endTime?: string | Date | null;
  startTime?: string | Date | null;
  fallbackDurationMs?: number;
  now?: Date;
}): boolean {
  const eventEnd = getEventEndDate({ endTime, startTime, fallbackDurationMs });
  return eventEnd ? now >= eventEnd : false;
}
