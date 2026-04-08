import { NextRequest, NextResponse } from "next/server";
import { getSignedImageUrl } from "@/app/lib/supabase";
import { getSessionUser } from "@/app/lib/auth";
import { getAppleWalletPass } from "@/app/lib/wallet";
import { db, eq, and, tickets } from "@ssb/db";

type TicketWalletData = {
  email: string;
  name?: string | null;
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
  eventAddress: string;
};

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      const redirectUrl = new URL("/api/auth/login", req.url);
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

    const ticket = await db.query.tickets.findFirst({
      where: and(eq(tickets.id, ticket_id), eq(tickets.email, user.email)),
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
            name: true,
            doorsOpen: true,
            startTimeDate: true,
            venue: true,
            img: true,
            appleWalletImg: true,
            venueLink: true,
            route: true,
            latitude: true,
            longitude: true,
            address: true,
          },
        },
      },
    });

    const event = ticket?.event;

    if (!ticket || !event) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const imgUrl = await getSignedImageUrl(
      event.appleWalletImg || event.img,
      3600,
    );
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
