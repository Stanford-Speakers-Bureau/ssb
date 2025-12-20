import { NextRequest, NextResponse } from 'next/server';
import {createServerSupabaseClient, getSignedImageUrl, getSupabaseClient} from "@/app/lib/supabase";
import {getWalletPass} from "@/app/lib/wallet";

type TicketWalletData = {
  email: string;
  eventName: string;
  ticketType: string;
  eventDoorTime: string;
  eventStartTime: string;
  ticketId: string;
  eventVenue: string;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const event_id = searchParams.get('event_id');

    if (!event_id) {
      return NextResponse.json(
        { error: "Missing required query parameter: event_id" },
        { status: 400 },
      );
    }

    const adminClient = getSupabaseClient();
    const { data: event } = await adminClient
      .from("events")
      .select("name, start_time_date, doors_open, venue, img")
      .eq("id", event_id)
      .single();

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 },
      );
    }

    const { data: ticket } = await adminClient
      .from("tickets")
      .select(
        `
          id,
          email,
          type,
          event_id,
          events (
            id,
            name,
            route,
            start_time_date,
            venue,
            venue_link,
            desc
          )
        `,
      )
      .eq("event_id", event_id)
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 },
      );
    }

    const imgUrl = await getSignedImageUrl(event.img, 3600);
    if (!imgUrl) {
      return NextResponse.json(
        { error: "Failed to get event image" },
        { status: 500 }
      );
    }
    const imgResponse = await fetch(imgUrl);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

    const ticketData: TicketWalletData = {
      email: ticket.email,
      eventName: event.name,
      ticketType: ticket.type,
      eventDoorTime: event.doors_open,
      eventStartTime: event.start_time_date,
      ticketId: ticket.id,
      eventVenue: event.venue,
    }

    const passBuf = await getWalletPass(imgBuffer, ticketData);

    if (!passBuf) {
      return NextResponse.json(
        { error: 'Pass data not available' },
        { status: 404 }
      );
    }

    // Create response with the pass data
  const response = new NextResponse(passBuf as BodyInit, {
    status: 200,
    headers: {
      // This tells the browser/phone "This is an Apple Wallet Pass"
      'Content-Type': 'application/vnd.apple.pkpass',
      // This gives the file a name when downloaded
      'Content-Disposition': 'attachment; filename=event-ticket.pkpass',
    },
  });

    return response;
  } catch (error) {
    console.error('Error generating Apple Wallet pass:', error);
    return NextResponse.json(
      { error: 'Failed to generate pass' },
      { status: 500 }
    );
  }
}