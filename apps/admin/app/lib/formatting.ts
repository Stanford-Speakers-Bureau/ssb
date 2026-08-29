import { PACIFIC_TIMEZONE } from "./constants";

export function formatDate(dateString: string | null): string {
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
    timeZone: PACIFIC_TIMEZONE,
  }).format(date);
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: PACIFIC_TIMEZONE,
  });
}

export function sortByStartDate<
  T extends { start_time_date?: string | null },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aVal = a.start_time_date ?? "";
    const bVal = b.start_time_date ?? "";
    return bVal.localeCompare(aVal);
  });
}
