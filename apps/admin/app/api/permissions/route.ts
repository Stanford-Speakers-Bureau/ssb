import { NextResponse } from "next/server";
import { normalizeEmail, verifyAdminRequest } from "@/app/lib/auth";
import {
  getPermissionDef,
  isPermissionAction,
  type PermissionAction,
} from "@/app/lib/permissions";
import { isValidEmail, isValidUUID } from "@/app/lib/validation";
import { and, db, eq, events, isNull, permissionGrants } from "@ssb/db";
import { logAuditEvent } from "@/app/lib/audit";

// Managing permissions is restricted to super-admins (the `admin` role).
export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { action: op, id } = body as {
      action?: "grant" | "revoke";
      id?: string;
    };

    if (op === "revoke") {
      if (!id || !isValidUUID(id)) {
        return NextResponse.json(
          { error: "Valid grant id is required" },
          { status: 400 },
        );
      }

      const existing = await db.query.permissionGrants.findFirst({
        where: eq(permissionGrants.id, id),
      });
      if (!existing) {
        return NextResponse.json({ error: "Grant not found" }, { status: 404 });
      }

      await db.delete(permissionGrants).where(eq(permissionGrants.id, id));

      await logAuditEvent({
        action: "permission.revoke",
        actor: auth.email!,
        targetEmail: existing.email,
        eventId: existing.eventId,
        metadata: { permission: existing.action },
      });

      return NextResponse.json({ success: true });
    }

    if (op !== "grant") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { email, permission, eventId } = body as {
      email?: string;
      permission?: string;
      eventId?: string | null;
    };

    const normalizedEmail = email ? normalizeEmail(email) : "";
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 },
      );
    }

    if (!permission || !isPermissionAction(permission)) {
      return NextResponse.json(
        { error: "Unknown permission" },
        { status: 400 },
      );
    }

    const def = getPermissionDef(permission as PermissionAction);

    let scopedEventId: string | null = null;
    if (def.scope === "global") {
      // Global permissions are always all-scope; ignore any eventId.
      scopedEventId = null;
    } else if (eventId == null || eventId === "") {
      // Event-scoped permission with no event = "all events".
      scopedEventId = null;
    } else {
      if (!isValidUUID(eventId)) {
        return NextResponse.json(
          { error: "Invalid event id" },
          { status: 400 },
        );
      }
      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: { id: true, name: true },
      });
      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      scopedEventId = eventId;
    }

    // Avoid duplicate grants (the unique index treats NULL as one value).
    const duplicate = await db.query.permissionGrants.findFirst({
      where: and(
        eq(permissionGrants.email, normalizedEmail),
        eq(permissionGrants.action, permission),
        scopedEventId === null
          ? isNull(permissionGrants.eventId)
          : eq(permissionGrants.eventId, scopedEventId),
      ),
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "This person already has that permission" },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(permissionGrants)
      .values({
        email: normalizedEmail,
        action: permission,
        eventId: scopedEventId,
        grantedBy: auth.email!,
      })
      .returning();

    await logAuditEvent({
      action: "permission.grant",
      actor: auth.email!,
      targetEmail: normalizedEmail,
      eventId: scopedEventId,
      metadata: { permission },
    });

    return NextResponse.json({
      success: true,
      grant: {
        id: created.id,
        email: created.email,
        action: created.action,
        eventId: created.eventId,
        grantedBy: created.grantedBy,
        created_at: created.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Permissions action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
