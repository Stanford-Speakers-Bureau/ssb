import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSignedImageUrl,
  getSupabaseClient,
} from "@/app/lib/supabase";
import { getAppleWalletPass } from "@/app/lib/wallet";

type TicketWalletData = {
  email: string;
  eventName: string;
  ticketType: string;
  eventDoorTime: string;
  start_time_date: string;
  ticketId: string;
  eventVenue: string;
  eventVenueLink: string;
  eventLink: string;
  eventLat: number;
  eventLng: number;
  eventAddress: number;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      const redirectUrl = new URL("/api/auth/google", req.url);
      console.log(redirectUrl);

      redirectUrl.searchParams.set(
        "redirect_to",
        "/api/tickets/apple-wallet?" + new URL(req.url).searchParams.toString(),
      );

      return NextResponse.redirect(redirectUrl);
    }

    const { searchParams } = new URL(req.url);
    const ticket_id = searchParams.get("ticket_id");

    if (!ticket_id) {
      return NextResponse.json(
        { error: "Missing required query parameter: ticket_id" },
        { status: 400 },
      );
    }

    const adminClient = getSupabaseClient();
    const { data: ticket } = await adminClient
      .from("tickets")
      .select(
        `
          id,
          email,
          type,
          event_id,
          events (
            name,
            doors_open,
            start_time_date,
            venue,
            img,
            venue_link,
            route,
            latitude,
            longitude,
            address
          )
        `,
      )
      .eq("id", ticket_id)
      .eq("email", user.email) // ensure the user actually owns the ticket
      .limit(1)
      .single();

    const event = Array.isArray(ticket?.events)
      ? ticket.events[0]
      : ticket?.events;

    if (!ticket || !event) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const imgUrl = await getSignedImageUrl(event.img, 3600);
    if (!imgUrl) {
      return NextResponse.json(
        { error: "Failed to get event image" },
        { status: 500 },
      );
    }
    const imgResponse = await fetch(imgUrl);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

    const ticketData: TicketWalletData = {
      email: ticket.email,
      eventName: event.name,
      ticketType: ticket.type,
      eventDoorTime: event.doors_open,
      ticketId: ticket.id,
      eventVenue: event.venue,
      eventVenueLink: event.venue_link,
      eventLink: `${process.env.NEXT_PUBLIC_BASE_URL}/events/${event.route}`,
      eventLat: event.latitude,
      eventLng: event.longitude,
      eventAddress: event.address,
      start_time_date: event.start_time_date,
    };

    const passBuf = await getAppleWalletPass(imgBuffer, ticketData);

    if (!passBuf) {
      return NextResponse.json(
        { error: "Pass data not available" },
        { status: 404 },
      );
    }

    // Create response with the pass data
    return new NextResponse(passBuf as BodyInit, {
      status: 200,
      headers: {
        // This tells the browser/phone "This is an Apple Wallet Pass"
        "Content-Type": "application/vnd.apple.pkpass",
        // This gives the file a name when downloaded
        "Content-Disposition": "attachment; filename=event-ticket.pkpass",
      },
    });
  } catch (error) {
    console.error("Error generating Apple Wallet pass:", error);
    return NextResponse.json(
      { error: "Failed to generate pass" },
      { status: 500 },
    );
  }
}
