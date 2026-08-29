import { NextRequest, NextResponse } from "next/server";
import { getImageProxyUrl } from "@/app/lib/supabase";
import { getSessionUser } from "@/app/lib/auth";
import { getGoogleWalletPass } from "@/app/lib/wallet";
import { db, eq, and, tickets } from "@ssb/db";

type TicketWalletData = {
  email: string;
  name?: string | null;
  eventName: string;
  ticketType: string;
  eventDoorTime: string;
  ticketId: string;
  eventVenue: string;
  eventVenueLink: string;
  eventLink: string;
  eventLat: number;
  eventLng: number;
  eventAddress: string;
  start_time_date: string;
};

async function getTicketForWallet(ticketId: string, userEmail: string) {
  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), eq(tickets.email, userEmail)),
    columns: {
      id: true,
      email: true,
      name: true,
      type: true,
      eventId: true,
    },
    with: {
      event: {
        columns: {
          id: true,
          name: true,
          route: true,
          doorsOpen: true,
          startTimeDate: true,
          venue: true,
          img: true,
          imgVersion: true,
          venueLink: true,
          latitude: true,
          longitude: true,
          address: true,
        },
      },
    },
  });

  return ticket;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();

    const ticket_id = req.nextUrl.searchParams.get("ticket_id");

    if (!user?.email) {
      const redirectUrl = new URL("/api/auth/login", req.url);
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

    const ticket = await getTicketForWallet(ticket_id, user.email);
    const event = ticket?.event;

    if (!ticket || !event) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const imgUrl = event.img
      ? `${process.env.NEXT_PUBLIC_SITE_URL}${getImageProxyUrl(event.id, event.imgVersion)}`
      : null;
    if (!imgUrl) {
      return NextResponse.json(
        { error: "Failed to get event image" },
        { status: 500 },
      );
    }

    const ticketData: TicketWalletData = {
      email: ticket.email,
      name: ticket.name,
      eventName: event.name!,
      ticketType: ticket.type,
      eventDoorTime: event.doorsOpen?.toISOString() ?? "",
      ticketId: ticket.id,
      eventVenue: event.venue!,
      eventVenueLink: event.venueLink!,
      eventLink: `${process.env.NEXT_PUBLIC_BASE_URL}/events/${event.route}`,
      eventLat: Number(event.latitude),
      eventLng: Number(event.longitude),
      eventAddress: event.address ?? "",
      start_time_date: event.startTimeDate?.toISOString() ?? "",
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
    const user = await getSessionUser();

    if (!user?.email) {
      const redirectUrl = new URL("/api/auth/login", req.url);
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

    const ticket = await getTicketForWallet(ticket_id, user.email);
    const event = ticket?.event;

    if (!ticket || !event) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const imgUrl = event.img
      ? `${process.env.NEXT_PUBLIC_SITE_URL}${getImageProxyUrl(event.id, event.imgVersion)}`
      : null;
    if (!imgUrl) {
      return NextResponse.json(
        { error: "Failed to get event image" },
        { status: 500 },
      );
    }
    const ticketData: TicketWalletData = {
      email: ticket.email,
      name: ticket.name,
      eventName: event.name!,
      ticketType: ticket.type,
      eventDoorTime: event.doorsOpen?.toISOString() ?? "",
      ticketId: ticket.id,
      eventVenue: event.venue!,
      eventVenueLink: event.venueLink!,
      eventLink: `${process.env.NEXT_PUBLIC_BASE_URL}/events/${event.route}`,
      eventLat: Number(event.latitude),
      eventLng: Number(event.longitude),
      eventAddress: event.address ?? "",
      start_time_date: event.startTimeDate?.toISOString() ?? "",
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
