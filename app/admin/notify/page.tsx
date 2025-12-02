import AdminNotifyClient, { EventWithNotifications } from "./AdminNotifyClient";

export const dynamic = "force-dynamic";

async function getInitialNotifications(): Promise<EventWithNotifications[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/admin/notifications`,
      { cache: "no-store" }
    );
    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to fetch initial notifications:", data.error || data);
      return [];
    }

    return data.events || [];
  } catch (error) {
    console.error("Failed to fetch initial notifications:", error);
    return [];
  }
}

export default async function AdminNotifyPage() {
  const initialEvents = await getInitialNotifications();
  return <AdminNotifyClient initialEvents={initialEvents} />;
}