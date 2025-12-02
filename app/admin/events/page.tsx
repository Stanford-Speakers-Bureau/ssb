import AdminEventsClient, { Event } from "./AdminEventsClient";

export const dynamic = "force-dynamic";

async function getInitialEvents(): Promise<Event[]> {
  try {
    // Use a relative URL so that admin auth cookies are forwarded to the API route.
    const response = await fetch(`/api/admin/events`, {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to fetch initial events:", data.error || data);
      return [];
    }

    return data.events || [];
  } catch (error) {
    console.error("Failed to fetch initial events:", error);
    return [];
  }
}

export default async function AdminEventsPage() {
  const initialEvents = await getInitialEvents();
  return <AdminEventsClient initialEvents={initialEvents} />;
}

