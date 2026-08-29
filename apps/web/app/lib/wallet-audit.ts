import { db, eq, auditLogs, tickets, walletVoidedPasses } from "@ssb/db";

type WalletAuditAction = "wallet.install" | "wallet.uninstall";

/**
 * Records a device-initiated wallet pass event (install/uninstall) in the
 * shared audit log. Best-effort: never throws into the PassKit web service —
 * a failed audit write must not break pass registration.
 *
 * Enriches the row with the attendee/event behind the serial (the ticket id),
 * falling back to a voided-pass tombstone since cancelled tickets are
 * hard-deleted. `source` is "wallet" to distinguish from admin-driven rows.
 */
export async function logWalletAudit(params: {
  action: WalletAuditAction;
  serialNumber: string;
  deviceLibraryId: string;
  passTypeId: string;
}): Promise<void> {
  try {
    let email: string | null = null;
    let eventId: string | null = null;
    let eventName: string | null = null;

    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, params.serialNumber),
      columns: { email: true, eventId: true },
      with: { event: { columns: { name: true } } },
    });
    if (ticket) {
      email = ticket.email;
      eventId = ticket.eventId;
      eventName = ticket.event?.name ?? null;
    } else {
      const tombstone = await db.query.walletVoidedPasses.findFirst({
        where: eq(walletVoidedPasses.serialNumber, params.serialNumber),
        columns: { email: true, eventId: true },
      });
      if (tombstone) {
        email = tombstone.email;
        eventId = tombstone.eventId;
      }
    }

    await db.insert(auditLogs).values({
      action: params.action,
      actor: email ?? "wallet-device",
      source: "wallet",
      eventId,
      eventName,
      targetEmail: email,
      metadata: JSON.stringify({
        serialNumber: params.serialNumber,
        deviceLibraryId: params.deviceLibraryId,
        passTypeId: params.passTypeId,
      }),
    });
  } catch (err) {
    console.error("[wallet-audit] failed to log event:", err);
  }
}
