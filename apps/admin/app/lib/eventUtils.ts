export function getNextEventId(
  events: { id: string; start_time_date: string | null }[],
): string {
  if (!events.length) return "";
  const now = new Date().toISOString();
  const sorted = [...events].sort((a, b) => {
    const aVal = a.start_time_date ?? "";
    const bVal = b.start_time_date ?? "";
    return aVal.localeCompare(bVal);
  });
  const datedEvents = sorted.filter((event) => event.start_time_date);
  const next = datedEvents.find((event) => (event.start_time_date ?? "") >= now);

  if (next) return next.id;
  if (datedEvents.length > 0) return datedEvents[datedEvents.length - 1]!.id;

  return events[0]?.id ?? "";
}
