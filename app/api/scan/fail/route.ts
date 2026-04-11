import { NextResponse } from "next/server";
import { verifyAdminOrScannerRequest, getSessionUser } from "@/app/lib/auth";
import { logAuditEvent } from "@/app/lib/audit";
import { db, eq, events } from "@ssb/db";

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminOrScannerRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { ticket_id, ticket_name, ticket_email } = body as {
      ticket_id: string;
      ticket_name?: string | null;
      ticket_email?: string | null;
    };

    if (!ticket_id) {
      return NextResponse.json(
        { error: "Missing required field: ticket_id" },
        { status: 400 },
      );
    }

    const scannerUser = await getSessionUser();
    const scannerEmail = scannerUser?.email || "unknown";

    const liveEvent = await db.query.events.findFirst({
      where: eq(events.live, true),
      columns: { id: true, name: true },
    });

    await logAuditEvent({
      action: "scan.fail",
      actor: scannerEmail,
      eventId: liveEvent?.id ?? null,
      eventName: liveEvent?.name ?? null,
      targetEmail: ticket_email ?? null,
      metadata: {
        ticket_id,
        ticket_name: ticket_name ?? null,
        reason: "id_mismatch",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to log scan failure:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
