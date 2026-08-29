import { NextResponse } from "next/server";
import { normalizeEmail } from "@/app/lib/auth";
import { requirePermission } from "@/app/lib/permissions";
import { getHighestAffiliation } from "@/app/lib/affiliation";
import { db, eq, events, inArray, tickets, userProfiles } from "@ssb/db";

type SalesAffiliationKey =
  | "student"
  | "faculty"
  | "affiliate"
  | "staff"
  | "member"
  | "unknown";

const AFFILIATION_PRIORITY: Exclude<SalesAffiliationKey, "unknown">[] = [
  "student",
  "faculty",
  "affiliate",
  "staff",
  "member",
];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("audience.view", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Get event capacity
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { capacity: true, releaseDate: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get all tickets ordered by creation time
    const ticketResults = await db.query.tickets.findMany({
      where: eq(tickets.eventId, eventId),
      columns: { createdAt: true, email: true, type: true },
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });

    const totalTickets = ticketResults.length;
    const vipCount = ticketResults.filter((t) => t.type === "VIP").length;
    const standardCount = totalTickets - vipCount;
    const ticketEmails = [
      ...new Set(ticketResults.map((ticket) => normalizeEmail(ticket.email)).filter(Boolean)),
    ];
    const profileRows =
      ticketEmails.length > 0
        ? await db.query.userProfiles.findMany({
            where: inArray(userProfiles.email, ticketEmails),
            columns: {
              email: true,
              eduPersonAffiliation: true,
              eduPersonScopedAffiliation: true,
            },
          })
        : [];
    const affiliationByEmail = new Map<string, SalesAffiliationKey>();

    for (const profile of profileRows) {
      affiliationByEmail.set(
        normalizeEmail(profile.email),
        getHighestAffiliation(
          [
            ...profile.eduPersonAffiliation,
            ...profile.eduPersonScopedAffiliation,
          ],
          AFFILIATION_PRIORITY,
        ) ?? "unknown",
      );
    }

    const byAffiliation: Record<SalesAffiliationKey, number> = {
      student: 0,
      faculty: 0,
      affiliate: 0,
      staff: 0,
      member: 0,
      unknown: 0,
    };

    for (const ticket of ticketResults) {
      const affiliation =
        affiliationByEmail.get(normalizeEmail(ticket.email)) ?? "unknown";
      byAffiliation[affiliation]++;
    }

    // Return individual timestamps — the client handles bucketing
    const timestamps = ticketResults.map((t) => t.createdAt.toISOString());

    // Compute milestones
    const milestonePercents = [25, 50, 75, 100];
    const milestones = milestonePercents.map((percent) => {
      const ticketNumber = Math.ceil((percent / 100) * event.capacity);
      const reached = totalTickets >= ticketNumber;
      const reachedAt =
        reached && ticketNumber > 0 && ticketNumber <= totalTickets
          ? ticketResults[ticketNumber - 1].createdAt.toISOString()
          : null;
      return { percent, reached, ticketNumber, reachedAt };
    });

    return NextResponse.json({
      timestamps,
      releaseDate: event.releaseDate ? event.releaseDate.toISOString() : null,
      totalTickets,
      capacity: event.capacity,
      vipCount,
      standardCount,
      byAffiliation,
      milestones,
    });
  } catch (error) {
    console.error("Ticket sales fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
