import AdminEventsClient, { Event } from "./AdminEventsClient";
import { getSignedImageUrl, verifyAdminRequest } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

async function getInitialEvents(): Promise<Event[]> {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return [];
    }

    const client = auth.adminClient!;

    const { data: events, error } = await client
      .from("events")
      .select("*")
      .order("start_time_date", { ascending: false });

    if (error) {
      console.error("Events fetch error:", error);
      return [];
    }

    const eventsWithImages = events
      ? await Promise.all(
          events.map(async (event: Event) => ({
            ...event,
            image_url: event.img
              ? await getSignedImageUrl(event.img, 60 * 60) // 1 hour expiry
              : null,
          })),
        )
      : [];

    return eventsWithImages as Event[];
  } catch (error) {
    console.error("Failed to fetch initial events:", error);
    return [];
  }
}

export default async function AdminEventsPage() {
  const initialEvents = await getInitialEvents();
  return <AdminEventsClient initialEvents={initialEvents} />;
}
