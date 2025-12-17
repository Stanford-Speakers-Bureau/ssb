import TicketManagementClient, { Ticket } from "./TicketManagementClient";
import { verifyAdminRequest } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

type EventData = {
  id: string;
  name: string | null;
  route: string | null;
  start_time_date: string | null;
};

type TicketRow = {
  id: string;
  email: string;
  type: string | null;
  created_at: string;
  scanned: boolean;
  scan_time: string | null;
  referral: string | null;
  event_id: string;
  events: EventData | EventData[] | null;
};

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

    // Handle events relation - Supabase may return it as array or object
    const typedTickets = (tickets || []) as TicketRow[];
    const transformedTickets: Ticket[] = typedTickets.map((ticket) => {
      let eventData: EventData | null = null;
      if (Array.isArray(ticket.events)) {
        eventData = ticket.events[0] || null;
      } else if (ticket.events) {
        eventData = ticket.events;
      }
      return {
        ...ticket,
        events: eventData
          ? {
              id: eventData.id,
              name: eventData.name ?? null,
              route: eventData.route ?? null,
              start_time_date: eventData.start_time_date ?? null,
            }
          : null,
      };
    });

    return {
      tickets: transformedTickets,
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
