import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/app/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 },
      );
    }

    const adminClient = auth.adminClient!;

    // Get event details to determine time range
    const { data: event, error: eventError } = await adminClient
      .from("events")
      .select("release_date, start_time_date")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Determine time range
    const startDate = event.release_date
      ? new Date(event.release_date)
      : new Date(); // If no release date, use current time
    const endDate = event.start_time_date
      ? new Date(event.start_time_date)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default to 7 days from now

    // Get all tickets for this event with created_at timestamps
    const { data: tickets, error: ticketsError } = await adminClient
      .from("tickets")
      .select("created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (ticketsError) {
      console.error("Tickets fetch error:", ticketsError);
      return NextResponse.json(
        { error: "Failed to fetch ticket data" },
        { status: 500 },
      );
    }

    // Calculate time intervals
    const timeRange = endDate.getTime() - startDate.getTime();
    const hours = Math.max(1, Math.ceil(timeRange / (1000 * 60 * 60)));

    // Determine interval size based on time range
    let intervalHours: number;
    if (hours <= 24) {
      intervalHours = 1; // 1 hour intervals for events within 24 hours
    } else if (hours <= 168) {
      intervalHours = 6; // 6 hour intervals for events within a week
    } else if (hours <= 720) {
      intervalHours = 24; // Daily intervals for events within a month
    } else {
      intervalHours = 168; // Weekly intervals for longer periods
    }

    // Create intervals
    const intervals: { time: string; count: number; cumulative: number }[] = [];
    let currentTime = new Date(startDate);
    let cumulativeCount = 0;

    while (currentTime < endDate) {
      const intervalEnd = new Date(
        currentTime.getTime() + intervalHours * 60 * 60 * 1000,
      );
      const intervalEndTime = intervalEnd > endDate ? endDate : intervalEnd;

      // Count tickets in this interval
      const intervalCount =
        tickets?.filter((ticket) => {
          const ticketTime = new Date(ticket.created_at);
          return ticketTime >= currentTime && ticketTime < intervalEndTime;
        }).length || 0;

      cumulativeCount += intervalCount;

      intervals.push({
        time: currentTime.toISOString(),
        count: intervalCount,
        cumulative: cumulativeCount,
      });

      currentTime = intervalEnd;
    }

    // Ensure we have at least one data point
    if (intervals.length === 0) {
      intervals.push({
        time: startDate.toISOString(),
        count: 0,
        cumulative: 0,
      });
    }

    return NextResponse.json({
      data: intervals,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalTickets: tickets?.length || 0,
    });
  } catch (error) {
    console.error("Ticket sales fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
