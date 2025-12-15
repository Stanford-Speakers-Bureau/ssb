import TicketManagementClient, { Ticket } from "./TicketManagementClient";
import { verifyAdminRequest, getSupabaseClient } from "../../lib/supabase";

export const dynamic = "force-dynamic";

async function getInitialTickets(): Promise<{
  tickets: Ticket[];
  total: number;
}> {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return { tickets: [], total: 0 };
    }

    const client = auth.adminClient!;

    const { data: tickets, error } = await client
      .from("tickets")
      .select(
        `
        id,
        email,
        type,
        created_at,
        scanned,
        scan_time,
        referral,
        event_id,
        events (
          id,
          name,
          route,
          start_time_date
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Tickets fetch error:", error);
      return { tickets: [], total: 0 };
    }

    const { count } = await client
      .from("tickets")
      .select("id", { count: "exact", head: true });

    return {
      tickets: (tickets as Ticket[]) || [],
      total: count || 0,
    };
  } catch (error) {
    console.error("Failed to fetch initial tickets:", error);
    return { tickets: [], total: 0 };
  }
}

async function getEvents() {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return [];
    }

    const client = auth.adminClient!;

    const { data: events, error } = await client
      .from("events")
      .select("id, name")
      .order("start_time_date", { ascending: false });

    if (error) {
      console.error("Events fetch error:", error);
      return [];
    }

    return events || [];
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return [];
  }
}

export default async function AdminTicketsPage() {
  const [{ tickets, total }, events] = await Promise.all([
    getInitialTickets(),
    getEvents(),
  ]);

  return (
    <TicketManagementClient
      initialTickets={tickets}
      initialTotal={total}
      initialEvents={events}
    />
  );
}
