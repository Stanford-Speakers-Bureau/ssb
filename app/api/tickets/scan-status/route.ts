import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase";
import { db, eq, and, tickets } from "@ssb/db";

export async function GET(req: NextRequest) {
  try {
    const ticketId = req.nextUrl.searchParams.get("ticket_id");
    if (!ticketId) {
      return NextResponse.json(
        { error: "Missing ticket_id" },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const ticket = await db.query.tickets.findFirst({
      where: and(eq(tickets.id, ticketId), eq(tickets.email, user.email)),
      columns: { scanned: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ scanned: ticket.scanned });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
