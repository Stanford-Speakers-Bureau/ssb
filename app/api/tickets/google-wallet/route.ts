import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getImageProxyUrl,
  getSupabaseClient,
} from "@/app/lib/supabase";
import { getGoogleWalletPass } from "@/app/lib/wallet";

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
  start_time_date: string;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    const ticket_id = req.nextUrl.searchParams.get("ticket_id");

    if (userError || !user?.email) {
      const redirectUrl = new URL("/api/auth/google", req.url);
      redirectUrl.searchParams.set(
        "redirect_to",
        "/api/tickets/google-wallet?ticket_id=" + ticket_id,
      );
      return NextResponse.redirect(redirectUrl);
    }

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
            id,
            name,
            route,
            doors_open,
            start_time_date,
            venue,
            img,
            img_version,
            venue_link,
            latitude,
            longitude,
            address
          )
        `,
      )
      .eq("id", ticket_id)
      .eq("email", user.email)
      .limit(1)
      .single();

    const event = Array.isArray(ticket?.events)
      ? ticket.events[0]
      : ticket?.events;

    if (!ticket || !event) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const imgUrl = event.img
      ? `${process.env.NEXT_PUBLIC_SITE_URL}${getImageProxyUrl(event.id, event.img_version)}`
      : null;
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
      start_time_date: event.start_time_date,
    };

    const walletUrl = await getGoogleWalletPass(imgUrl, ticketData);
    if (!walletUrl) {
      return NextResponse.json(
        { error: "Pass data not available" },
        { status: 404 },
      );
    }

    // Redirect directly to the Google Wallet save URL
    return NextResponse.redirect(walletUrl);
  } catch (error) {
    console.error("Error generating Google Wallet pass:", error);
    return NextResponse.json(
      { error: "Failed to generate pass" },
      { status: 500 },
    );
  }
}

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

      redirectUrl.searchParams.set(
        "redirect_to",
        "/api/tickets/google-wallet?" +
          new URL(req.url).searchParams.toString(),
      );

      return NextResponse.redirect(redirectUrl);
    }
    const body = (await req.json()) as { ticket_id?: string };
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
            doors_open,
            start_time_date,
            venue,
            img,
            img_version,
            venue_link,
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

    const imgUrl = event.img
      ? `${process.env.NEXT_PUBLIC_SITE_URL}${getImageProxyUrl(event.id, event.img_version)}`
      : null;
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
      start_time_date: event.start_time_date,
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
