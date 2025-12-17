import AdminNotifyClient, { EventWithNotifications } from "./AdminNotifyClient";
import { verifyAdminRequest } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

async function getInitialNotifications(): Promise<EventWithNotifications[]> {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return [];
    }

    const client = auth.adminClient!;

    const [
      { data: events, error: eventsError },
      { data: notifications, error: notifyError },
    ] = await Promise.all([
      client
        .from("events")
        .select("id, name, start_time_date")
        .order("start_time_date", { ascending: false }),
      client
        .from("notify")
        .select("id, email, created_at, speaker_id")
        .order("created_at", { ascending: false }),
    ]);

    if (eventsError) {
      console.error("Events fetch error:", eventsError);
    }
    if (notifyError) {
      console.error("Notifications fetch error:", notifyError);
    }

    const eventsWithNotifications =
      events?.map((event: any) => ({
        ...event,
        notifications:
          notifications?.filter((n: any) => n.speaker_id === event.id) || [],
      })) || [];

    return eventsWithNotifications as EventWithNotifications[];
  } catch (error) {
    console.error("Failed to fetch initial notifications:", error);
    return [];
  }
}

export default async function AdminNotifyPage() {
  const initialEvents = await getInitialNotifications();
  return <AdminNotifyClient initialEvents={initialEvents} />;
}
