import { NextRequest, NextResponse } from "next/server";
import { db, and, eq, walletRegistrations } from "@ssb/db";
import { verifyApplePassAuth } from "@/app/lib/wallet-pass-builder";
import { logWalletAudit } from "@/app/lib/wallet-audit";

type Params = {
  params: Promise<{
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
    serialNumber: string;
  }>;
};

// POST .../registrations/{passType}/{serial}
// Device asks us to keep this pass updated. Body: { pushToken }.
// 201 = newly registered, 200 = already registered, 401 = bad auth token.
export async function POST(req: NextRequest, { params }: Params) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } =
    await params;

  if (!(await verifyApplePassAuth(req, serialNumber))) {
    return new NextResponse(null, { status: 401 });
  }

  let pushToken: string | undefined;
  try {
    pushToken = ((await req.json()) as { pushToken?: string })?.pushToken;
  } catch {
    pushToken = undefined;
  }
  if (!pushToken) {
    return new NextResponse(null, { status: 400 });
  }

  const existing = await db.query.walletRegistrations.findFirst({
    where: and(
      eq(walletRegistrations.deviceLibraryId, deviceLibraryIdentifier),
      eq(walletRegistrations.serialNumber, serialNumber),
    ),
    columns: { id: true },
  });

  if (existing) {
    // Push token can change between registrations; keep it current.
    await db
      .update(walletRegistrations)
      .set({ pushToken })
      .where(eq(walletRegistrations.id, existing.id));
    return new NextResponse(null, { status: 200 });
  }

  await db.insert(walletRegistrations).values({
    deviceLibraryId: deviceLibraryIdentifier,
    passTypeId: passTypeIdentifier,
    serialNumber,
    pushToken,
  });
  // Audit only first-time installs — re-registrations (200 above) are routine
  // push-token refreshes, not new installs.
  await logWalletAudit({
    action: "wallet.install",
    serialNumber,
    deviceLibraryId: deviceLibraryIdentifier,
    passTypeId: passTypeIdentifier,
  });
  return new NextResponse(null, { status: 201 });
}

// DELETE .../registrations/{passType}/{serial}
// Device removed the pass; stop pushing to it.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } =
    await params;

  if (!(await verifyApplePassAuth(req, serialNumber))) {
    return new NextResponse(null, { status: 401 });
  }

  const deleted = await db
    .delete(walletRegistrations)
    .where(
      and(
        eq(walletRegistrations.deviceLibraryId, deviceLibraryIdentifier),
        eq(walletRegistrations.serialNumber, serialNumber),
      ),
    )
    .returning({ id: walletRegistrations.id });

  // Only audit a real uninstall (a row existed); Apple may retry DELETEs.
  if (deleted.length > 0) {
    await logWalletAudit({
      action: "wallet.uninstall",
      serialNumber,
      deviceLibraryId: deviceLibraryIdentifier,
      passTypeId: passTypeIdentifier,
    });
  }
  return new NextResponse(null, { status: 200 });
}
