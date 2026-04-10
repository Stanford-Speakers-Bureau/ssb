import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { fetchWithTimeout, isFetchTimeoutError } from "@/app/lib/fetch";
import { getSignedImageUrl } from "@/app/lib/supabase";
import { verifyAppleWalletToken } from "@/app/lib/wallet-links";
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

const APPLE_WALLET_IMAGE_FETCH_TIMEOUT_MS = 10_000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticket_id = searchParams.get("ticket_id");
    const walletToken = searchParams.get("wallet_token");

    const verifiedWalletToken = walletToken
      ? await verifyAppleWalletToken(walletToken)
      : null;

    if (walletToken && !verifiedWalletToken) {
      return NextResponse.json(
        { error: "Invalid or expired wallet token" },
        { status: 401 },
      );
    }

    if (
      verifiedWalletToken
      && ticket_id
      && ticket_id !== verifiedWalletToken.ticketId
    ) {
      return NextResponse.json(
        { error: "Wallet token does not match the requested ticket" },
        { status: 401 },
      );
    }

    const resolvedTicketId = verifiedWalletToken?.ticketId ?? ticket_id;

    if (!resolvedTicketId) {
      return NextResponse.json(
        { error: "Missing required query parameter: ticket_id or wallet_token" },
        { status: 400 },
      );
    }

    const sessionUser = verifiedWalletToken ? null : await getSessionUser();

    if (!verifiedWalletToken && !sessionUser?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const sessionUserEmail = sessionUser?.email ?? null;

    const ticket = await db.query.tickets.findFirst({
      where: verifiedWalletToken
        ? and(
          eq(tickets.id, verifiedWalletToken.ticketId),
          eq(tickets.email, verifiedWalletToken.email),
        )
        : and(
          eq(tickets.id, resolvedTicketId),
          eq(tickets.email, sessionUserEmail!),
        ),
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
    let imgResponse: Response;
    try {
      imgResponse = await fetchWithTimeout(
        imgUrl,
        {},
        APPLE_WALLET_IMAGE_FETCH_TIMEOUT_MS,
      );
    } catch (error) {
      if (isFetchTimeoutError(error)) {
        return NextResponse.json(
          { error: "Timed out while loading the event image" },
          { status: 504 },
        );
      }

      throw error;
    }

    if (!imgResponse.ok) {
      return NextResponse.json(
        { error: "Failed to load event image" },
        { status: 502 },
      );
    }

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
