import { NextRequest, NextResponse } from "next/server";
import {
  db,
  and,
  eq,
  inArray,
  tickets,
  walletRegistrations,
  walletVoidedPasses,
} from "@ssb/db";

type Params = {
  params: Promise<{
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
  }>;
};

// GET .../registrations/{passType}?passesUpdatedSince={tag}
// Returns the serials registered to this device that changed since {tag}.
// {tag} is the `lastUpdated` we handed back last time (epoch ms as a string).
// 200 with serials, or 204 when nothing changed.
export async function GET(req: NextRequest, { params }: Params) {
  const { deviceLibraryIdentifier, passTypeIdentifier } = await params;
  const since = req.nextUrl.searchParams.get("passesUpdatedSince");
  const sinceMs = since ? Number(since) : 0;

  const registrations = await db.query.walletRegistrations.findMany({
    where: and(
      eq(walletRegistrations.deviceLibraryId, deviceLibraryIdentifier),
      eq(walletRegistrations.passTypeId, passTypeIdentifier),
    ),
    columns: { serialNumber: true },
  });

  if (registrations.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const serials = registrations.map((r) => r.serialNumber);
  const floor = Number.isFinite(sinceMs) ? sinceMs : 0;

  // A serial is either a live ticket or, once cancelled, a voided tombstone.
  const [liveRows, voidedRows] = await Promise.all([
    db.query.tickets.findMany({
      where: inArray(tickets.id, serials),
      columns: { id: true, walletUpdatedAt: true, createdAt: true },
    }),
    db.query.walletVoidedPasses.findMany({
      where: inArray(walletVoidedPasses.serialNumber, serials),
      columns: { serialNumber: true, voidedAt: true },
    }),
  ]);

  const updated: { serial: string; ms: number }[] = [];
  for (const row of liveRows) {
    const ms = (row.walletUpdatedAt ?? row.createdAt).getTime();
    if (ms > floor) updated.push({ serial: row.id, ms });
  }
  for (const row of voidedRows) {
    const ms = row.voidedAt.getTime();
    if (ms > floor) updated.push({ serial: row.serialNumber, ms });
  }

  if (updated.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const lastUpdated = Math.max(...updated.map((u) => u.ms));
  return NextResponse.json({
    lastUpdated: String(lastUpdated),
    serialNumbers: updated.map((u) => u.serial),
  });
}
