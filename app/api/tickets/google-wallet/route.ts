import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSignedImageUrl,
  getSupabaseClient,
} from "@/app/lib/supabase";
import { getAppleWalletPass, getGoogleWalletPass } from "@/app/lib/wallet";
import {redirect} from "next/navigation";

type TicketWalletData = {
  email: string;
  eventName: string;
  ticketType: string;
  eventDoorTime: string;
  ticketId: string;
  eventVenue: string;
  eventVenueLink: string;
  eventLink: string;
  eventLat: number;
  eventLng: number;
  eventAddress: number;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      const redirectUrl = new URL("/api/auth/google", req.url);
      console.log(redirectUrl);

      redirectUrl.searchParams.set("redirect_to", "/api/tickets/google-wallet?" + new URL(req.url).searchParams.toString());

      return NextResponse.redirect(redirectUrl);
    }
    const body = await req.json();
    const ticket_id = body.ticket_id;

    if (!ticket_id) {
      return NextResponse.json(
        { error: "Missing required field: ticket_id" },
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
      .eq("id", ticket_id)
      .eq("email", user.email) // ensure the user actually owns the ticket
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const { data: event } = await adminClient
      .from("events")
      .select(
        "name, doors_open, venue, img, venue_link, route, latitude, longitude, address",
      )
      .eq("id", ticket.event_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const imgUrl = await getSignedImageUrl(event.img, 31_556_952);
    if (!imgUrl) {
      return NextResponse.json(
        { error: "Failed to get event image" },
        { status: 500 },
      );
    }
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
    };

    const passBuf = await getGoogleWalletPass(imgUrl, ticketData);
    if (!passBuf) {
      return NextResponse.json(
        { error: "Pass data not available" },
        { status: 404 },
      );
    }

    return NextResponse.json({ url: passBuf }, { status: 200 });
  } catch (error) {
    console.error("Error generating Google Wallet pass:", error);
    return NextResponse.json(
      { error: "Failed to generate pass" },
      { status: 500 },
    );
  }
}
