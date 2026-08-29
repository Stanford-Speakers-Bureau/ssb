import { NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/permissions";
import { isValidUUID } from "@/app/lib/validation";
import {
  and,
  canceledTickets,
  count,
  db,
  desc,
  eq,
  eventFeedback,
  events,
  sql,
  tickets,
  waitlist,
} from "@ssb/db";

export async function GET(
  req: Request,
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

    const auth = await requirePermission("audience.view", eventId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const [event, ticketResults, canceledTicketResults, waitlistResult, feedbackAggregateRows, recentFeedbackComments] = await Promise.all([
      db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          name: true,
          capacity: true,
          ticketingDate: true,
          releaseDate: true,
          startTimeDate: true,
          doorsOpen: true,
          standbyEnabled: true,
          reserved: true,
        },
      }),
      db.query.tickets.findMany({
        where: eq(tickets.eventId, eventId),
        columns: {
          type: true,
          scanned: true,
          scanTime: true,
          createdAt: true,
          scanUser: true,
          scanEmail: true,
          name: true,
          referral: true,
        },
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      }),
      db.query.canceledTickets.findMany({
        where: eq(canceledTickets.eventId, eventId),
        columns: {
          createdAt: true,
          canceledAt: true,
        },
        orderBy: (c, { asc }) => [asc(c.createdAt)],
      }),
      db
        .select({ value: count() })
        .from(waitlist)
        .where(eq(waitlist.eventId, eventId)),
      db.select({
        responseCount: sql<number>`count(*)`,
        commentCount:
          sql<number>`count(*) filter (where length(trim(coalesce(${eventFeedback.comment}, ''))) > 0)`,
        promoterCount:
          sql<number>`count(*) filter (where ${eventFeedback.score} >= 9)`,
        passiveCount:
          sql<number>`count(*) filter (where ${eventFeedback.score} between 7 and 8)`,
        detractorCount:
          sql<number>`count(*) filter (where ${eventFeedback.score} <= 6)`,
        averageScore: sql<number | null>`avg(${eventFeedback.score})::float`,
      })
        .from(eventFeedback)
        .where(eq(eventFeedback.eventId, eventId)),
      db.select({
        id: eventFeedback.id,
        score: eventFeedback.score,
        comment: eventFeedback.comment,
        updatedAt: eventFeedback.updatedAt,
        attendeeName: tickets.name,
        attendeeEmail: tickets.email,
      })
        .from(eventFeedback)
        .leftJoin(tickets, eq(eventFeedback.ticketId, tickets.id))
        .where(
          and(
            eq(eventFeedback.eventId, eventId),
            sql<boolean>`length(trim(coalesce(${eventFeedback.comment}, ''))) > 0`,
          ),
        )
        .orderBy(desc(eventFeedback.updatedAt))
        .limit(8),
    ]);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // "Sales open" = ticketing_date, falling back to release_date — matches the
    // gating logic in web/app/api/tickets/route.ts.
    const salesOpenDate = event.ticketingDate ?? event.releaseDate ?? null;

    const totalTickets = ticketResults.length;
    const scannedTickets = ticketResults.filter((t) => t.scanned);
    const scannedCount = scannedTickets.length;
    const unscannedCount = totalTickets - scannedCount;
    const flakeRate = totalTickets > 0 ? (unscannedCount / totalTickets) * 100 : 0;

    type TypeKey = "STANDARD" | "VIP" | "EXTERNAL" | "STANDBY";
    const byType: Record<
      TypeKey,
      { total: number; scanned: number; flakeRate: number }
    > = {
      STANDARD: { total: 0, scanned: 0, flakeRate: 0 },
      VIP: { total: 0, scanned: 0, flakeRate: 0 },
      EXTERNAL: { total: 0, scanned: 0, flakeRate: 0 },
      STANDBY: { total: 0, scanned: 0, flakeRate: 0 },
    };

    for (const t of ticketResults) {
      const key = (t.type?.toUpperCase() ?? "STANDARD") as TypeKey;
      const bucket = byType[key] ?? byType.STANDARD;
      bucket.total++;
      if (t.scanned) bucket.scanned++;
    }

    for (const key of Object.keys(byType) as TypeKey[]) {
      const b = byType[key];
      b.flakeRate =
        b.total > 0 ? ((b.total - b.scanned) / b.total) * 100 : 0;
    }

    // Raw timestamps for client-side charting
    const scanTimestamps = scannedTickets
      .filter((t) => t.scanTime)
      .map((t) => t.scanTime!.toISOString())
      .sort();

    const ticketTimestamps = ticketResults.map((t) =>
      t.createdAt.toISOString(),
    );

    // Purchase times of tickets that ended up scanning in — lets the client
    // chart show-up rate as a function of when the ticket was bought.
    const scannedPurchaseTimestamps = scannedTickets.map((t) =>
      t.createdAt.toISOString(),
    );

    // Canceled tickets, kept in a separate archive (the live row is hard-deleted
    // on cancel). `purchase` is the original buy time — the same x-axis the
    // purchase-timing chart buckets by — so the client can fold cancellations
    // into the show-up-rate denominator. `canceledAt` lets it optionally treat a
    // cancellation "as of" a chosen time (e.g. launch day), since people often
    // don't cancel until weeks later. Parallel arrays, same order.
    const canceledPurchaseTimestamps = canceledTicketResults.map((c) =>
      c.createdAt.toISOString(),
    );
    const canceledAtTimestamps = canceledTicketResults.map((c) =>
      c.canceledAt.toISOString(),
    );

    // Compute average arrival offset from doors open
    let averageArrivalOffsetMs: number | null = null;
    if (event.doorsOpen && scanTimestamps.length > 0) {
      const doorsMs = event.doorsOpen.getTime();
      let totalOffset = 0;
      let counted = 0;
      for (const ts of scanTimestamps) {
        const offset = new Date(ts).getTime() - doorsMs;
        if (offset >= 0) {
          totalOffset += offset;
          counted++;
        }
      }
      if (counted > 0) {
        averageArrivalOffsetMs = totalOffset / counted;
      }
    }

    // Find peak check-in interval (15-min buckets)
    let peakInterval: {
      start: string;
      end: string;
      count: number;
    } | null = null;
    if (scanTimestamps.length > 0) {
      const BUCKET = 15 * 60_000;
      const buckets = new Map<number, number>();
      for (const ts of scanTimestamps) {
        const ms = new Date(ts).getTime();
        const key = Math.floor(ms / BUCKET) * BUCKET;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
      let peakKey = 0;
      let peakCount = 0;
      for (const [k, v] of buckets) {
        if (v > peakCount) {
          peakKey = k;
          peakCount = v;
        }
      }
      if (peakCount > 0) {
        peakInterval = {
          start: new Date(peakKey).toISOString(),
          end: new Date(peakKey + BUCKET).toISOString(),
          count: peakCount,
        };
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

    // Early-bird flake analysis. "Early" is anchored to when tickets were
    // released (sales open); fall back to the first ticket sold if unset.
    let earlyBirdFlake: { earlyFlakeRate: number; lateFlakeRate: number; earlyTotal: number; lateTotal: number } | null = null;
    if (ticketResults.length > 0 && event.startTimeDate) {
      const launchTime = salesOpenDate
        ? salesOpenDate.getTime()
        : ticketResults[0].createdAt.getTime();
      const eventTime = event.startTimeDate.getTime();
      const earlyWindow = launchTime + 24 * 60 * 60_000;
      const lateWindow = eventTime - 24 * 60 * 60_000;

      const earlyTickets = ticketResults.filter((t) => t.createdAt.getTime() <= earlyWindow);
      const lateTickets = ticketResults.filter((t) => t.createdAt.getTime() >= lateWindow);

      const earlyFlaked = earlyTickets.filter((t) => !t.scanned).length;
      const lateFlaked = lateTickets.filter((t) => !t.scanned).length;

      if (earlyTickets.length > 0 && lateTickets.length > 0) {
        earlyBirdFlake = {
          earlyFlakeRate: (earlyFlaked / earlyTickets.length) * 100,
          lateFlakeRate: (lateFlaked / lateTickets.length) * 100,
          earlyTotal: earlyTickets.length,
          lateTotal: lateTickets.length,
        };
      }
    }

    // Referral attendance
    let referralAttendance: { referralShowRate: number; organicShowRate: number; referralTotal: number; organicTotal: number } | null = null;
    {
      const refTickets = ticketResults.filter((t) => t.referral);
      const orgTickets = ticketResults.filter((t) => !t.referral);
      if (refTickets.length > 0 && orgTickets.length > 0) {
        const refScanned = refTickets.filter((t) => t.scanned).length;
        const orgScanned = orgTickets.filter((t) => t.scanned).length;
        referralAttendance = {
          referralShowRate: (refScanned / refTickets.length) * 100,
          organicShowRate: (orgScanned / orgTickets.length) * 100,
          referralTotal: refTickets.length,
          organicTotal: orgTickets.length,
        };
      }
    }

    // Arrival distribution — even time buckets based on actual scan range
    let arrivalDistribution: { buckets: { label: string; count: number }[]; total: number } | null = null;
    if (scanTimestamps.length > 0) {
      const scanMs = scanTimestamps.map((ts) => new Date(ts).getTime());
      const minScan = scanMs[0];
      const maxScan = scanMs[scanMs.length - 1];
      const span = maxScan - minScan;

      const BUCKET_COUNT = Math.min(6, scanMs.length);
      if (BUCKET_COUNT >= 2 && span > 0) {
        const bucketSize = span / BUCKET_COUNT;
        const counts = new Array<number>(BUCKET_COUNT).fill(0);
        for (const ms of scanMs) {
          const idx = Math.min(Math.floor((ms - minScan) / bucketSize), BUCKET_COUNT - 1);
          counts[idx]++;
        }
        const fmt = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" });
        const buckets = counts.map((count, i) => ({
          label: fmt(minScan + i * bucketSize),
          count,
        }));
        arrivalDistribution = { buckets, total: scanMs.length };
      }
    }

    const feedbackAggregate = feedbackAggregateRows[0];
    const feedbackResponseCount = Number(feedbackAggregate?.responseCount ?? 0);
    const commentCount = Number(feedbackAggregate?.commentCount ?? 0);
    const promoterCount = Number(feedbackAggregate?.promoterCount ?? 0);
    const passiveCount = Number(feedbackAggregate?.passiveCount ?? 0);
    const detractorCount = Number(feedbackAggregate?.detractorCount ?? 0);
    const averageScoreValue = feedbackAggregate?.averageScore;
    const feedbackAverageScore = averageScoreValue == null
      ? null
      : Number(averageScoreValue);
    const feedbackNps = feedbackResponseCount > 0
      ? ((promoterCount / feedbackResponseCount)
        - (detractorCount / feedbackResponseCount)) * 100
      : null;
    const feedbackResponseRate = scannedCount > 0
      ? (feedbackResponseCount / scannedCount) * 100
      : 0;
    const feedbackStats = {
      responseCount: feedbackResponseCount,
      responseRate: feedbackResponseRate,
      averageScore: feedbackAverageScore,
      nps: feedbackNps,
      promoterCount,
      passiveCount,
      detractorCount,
      commentCount,
      recentComments: recentFeedbackComments.map((entry) => ({
        id: entry.id,
        attendeeName: entry.attendeeName?.trim() || null,
        attendeeEmail: entry.attendeeEmail ?? null,
        score: entry.score,
        comment: entry.comment?.trim() ?? "",
        updatedAt: entry.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json({
      eventName: event.name,
      eventDate: event.startTimeDate?.toISOString() ?? null,
      capacity: event.capacity ?? 0,
      reserved: event.reserved ?? 0,
      salesOpenAt: salesOpenDate?.toISOString() ?? null,
      doorsOpen: event.doorsOpen?.toISOString() ?? null,
      startTime: event.startTimeDate?.toISOString() ?? null,
      standbyEnabled: event.standbyEnabled ?? false,
      totalTickets,
      scannedCount,
      unscannedCount,
      flakeRate,
      byType,
      scanTimestamps,
      ticketTimestamps,
      scannedPurchaseTimestamps,
      canceledPurchaseTimestamps,
      canceledAtTimestamps,
      waitlistCount: waitlistResult[0]?.value ?? 0,
      averageArrivalOffsetMs,
      peakInterval,
      scannerLeaderboard,
      earlyBirdFlake,
      referralAttendance,
      arrivalDistribution,
      feedbackStats,
    });
  } catch (error) {
    console.error("Summary data fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
