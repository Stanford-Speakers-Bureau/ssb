import { NextResponse } from "next/server";
import { getHighestAffiliation } from "@/app/lib/affiliation";
import { requirePermission } from "@/app/lib/permissions";
import { isValidUUID } from "@/app/lib/validation";
import {
  count,
  db,
  eq,
  events,
  inArray,
  tickets,
  userProfiles,
  waitlist,
} from "@ssb/db";

type TypeKey = "STANDARD" | "VIP" | "EXTERNAL" | "STANDBY";
type AffiliationKey = "student" | "staff" | "faculty" | "member" | "unknown";

const AFFILIATION_PRIORITY: Exclude<AffiliationKey, "unknown">[] = [
  "student",
  "faculty",
  "staff",
  "member",
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Valid event ID is required" },
        { status: 400 },
      );
    }

    const auth = await requirePermission("tickets.scan", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const [event, ticketResults, waitlistResult] = await Promise.all([
      db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          capacity: true,
          live: true,
          doorsOpen: true,
          startTimeDate: true,
          standbyEnabled: true,
          name: true,
        },
      }),
      db.query.tickets.findMany({
        where: eq(tickets.eventId, eventId),
        columns: {
          email: true,
          scanned: true,
          scanTime: true,
          type: true,
          name: true,
          createdAt: true,
          scanUser: true,
          scanEmail: true,
        },
      }),
      db
        .select({ value: count() })
        .from(waitlist)
        .where(eq(waitlist.eventId, eventId)),
    ]);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const totalTickets = ticketResults.length;
    const scannedTickets = ticketResults.filter((t) => t.scanned);
    const scannedCount = scannedTickets.length;
    const profileLookupEmails = Array.from(
      new Set(
        ticketResults.flatMap((ticket) => {
          const normalized = normalizeEmail(ticket.email);
          return normalized && normalized !== ticket.email
            ? [ticket.email, normalized]
            : [ticket.email];
        }),
      ),
    );
    const profileRows =
      profileLookupEmails.length > 0
        ? await db.query.userProfiles.findMany({
            where: inArray(userProfiles.email, profileLookupEmails),
            columns: {
              email: true,
              eduPersonAffiliation: true,
              eduPersonScopedAffiliation: true,
            },
          })
        : [];
    const affiliationByEmail = new Map<string, AffiliationKey>();

    for (const profile of profileRows) {
      const email = normalizeEmail(profile.email);
      const currentAffiliation = affiliationByEmail.get(email);

      if (currentAffiliation && currentAffiliation !== "unknown") {
        continue;
      }

      affiliationByEmail.set(
        email,
        getHighestAffiliation(
          [
            ...profile.eduPersonAffiliation,
            ...profile.eduPersonScopedAffiliation,
          ],
          AFFILIATION_PRIORITY,
        ) ?? "unknown",
      );
    }

    const scanEvents = scannedTickets
      .filter((t) => t.scanTime)
      .map((t) => ({
        name: t.name,
        type: t.type,
        scanTime: t.scanTime!.toISOString(),
        scannedBy: t.scanUser || null,
        scannerKey: t.scanEmail || t.scanUser || "unknown",
      }))
      .sort((a, b) => a.scanTime.localeCompare(b.scanTime));

    const scanTimestamps = scanEvents.map((scan) => scan.scanTime);
    const byType: Record<TypeKey, { total: number; scanned: number }> = {
      STANDARD: { total: 0, scanned: 0 },
      VIP: { total: 0, scanned: 0 },
      EXTERNAL: { total: 0, scanned: 0 },
      STANDBY: { total: 0, scanned: 0 },
    };
    const byAffiliation: Record<AffiliationKey, { total: number; scanned: number }> = {
      student: { total: 0, scanned: 0 },
      staff: { total: 0, scanned: 0 },
      faculty: { total: 0, scanned: 0 },
      member: { total: 0, scanned: 0 },
      unknown: { total: 0, scanned: 0 },
    };

    for (const t of ticketResults) {
      const key = (t.type?.toUpperCase() ?? "STANDARD") as TypeKey;
      const typeBucket = byType[key] ?? byType.STANDARD;
      const affiliationKey =
        affiliationByEmail.get(normalizeEmail(t.email)) ?? "unknown";
      const affiliationBucket = byAffiliation[affiliationKey];

      typeBucket.total++;
      affiliationBucket.total++;

      if (t.scanned) {
        typeBucket.scanned++;
        affiliationBucket.scanned++;
      }
    }

    // Scanner leaderboard
    const scannerCounts = new Map<string, { name: string; email: string; count: number }>();
    for (const t of scannedTickets) {
      const scannerName = t.scanUser || "Unknown";
      const scannerEmail = t.scanEmail || "";
      const key = scannerEmail || scannerName;
      const entry = scannerCounts.get(key);
      if (entry) {
        entry.count++;
      } else {
        scannerCounts.set(key, { name: scannerName, email: scannerEmail, count: 1 });
      }
    }
    const scannerLeaderboard = [...scannerCounts.values()].sort((a, b) => b.count - a.count);

    // Peak scans per minute
    let peakScansPerMin = 0;
    if (scanTimestamps.length > 0) {
      const minuteBuckets = new Map<number, number>();
      for (const ts of scanTimestamps) {
        const ms = new Date(ts).getTime();
        const key = Math.floor(ms / 60_000) * 60_000;
        minuteBuckets.set(key, (minuteBuckets.get(key) ?? 0) + 1);
      }
      for (const v of minuteBuckets.values()) {
        if (v > peakScansPerMin) peakScansPerMin = v;
      }
    }

    // Standby ticket creation timestamps for standby line growth chart
    const standbyTimestamps = ticketResults
      .filter((t) => (t.type?.toUpperCase() ?? "STANDARD") === "STANDBY")
      .map((t) => t.createdAt.toISOString())
      .sort();

    return NextResponse.json({
      scanEvents,
      scanTimestamps,
      totalTickets,
      scannedCount,
      isLive: event.live ?? false,
      capacity: event.capacity ?? 0,
      doorsOpen: event.doorsOpen?.toISOString() ?? null,
      startTime: event.startTimeDate?.toISOString() ?? null,
      standbyEnabled: event.standbyEnabled ?? false,
      waitlistCount: waitlistResult[0]?.value ?? 0,
      byType,
      byAffiliation,
      standbyTimestamps,
      scannerLeaderboard,
      peakScansPerMin,
    });
  } catch (error) {
    console.error("Check-in data fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
