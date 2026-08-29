import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/app/lib/auth";
import {
  db,
  auditLogs,
  desc,
  and,
  eq,
  gte,
  lte,
  ilike,
  inArray,
} from "@ssb/db";
import { groupAuditLogs } from "@/app/lib/audit-log-groups";

function parsePaginationParam(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const actions = [...new Set(searchParams.getAll("action").filter(Boolean))];
    const actor = searchParams.get("actor");
    const sources = [...new Set(searchParams.getAll("source").filter(Boolean))];
    const targetEmail = searchParams.get("targetEmail");
    const eventName = searchParams.get("eventName");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parsePaginationParam(searchParams.get("limit"), 50, 0, 200);
    const offset = parsePaginationParam(
      searchParams.get("offset"),
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    );

    const conditions: ReturnType<typeof eq>[] = [];

    // When the filter includes mass emails, always also include the
    // per-recipient failure rows so they can be folded into the group view.
    const effectiveActions =
      actions.length > 0 && actions.includes("email.send_mass")
        ? Array.from(new Set([...actions, "email.send_failed"]))
        : actions;

    if (effectiveActions.length === 1) {
      conditions.push(eq(auditLogs.action, effectiveActions[0]));
    } else if (effectiveActions.length > 1) {
      conditions.push(inArray(auditLogs.action, effectiveActions));
    }
    if (actor) conditions.push(ilike(auditLogs.actor, `%${actor}%`));
    if (sources.length === 1) {
      conditions.push(eq(auditLogs.source, sources[0]));
    } else if (sources.length > 1) {
      conditions.push(inArray(auditLogs.source, sources));
    }
    if (targetEmail)
      conditions.push(ilike(auditLogs.targetEmail, `%${targetEmail}%`));
    if (eventName)
      conditions.push(ilike(auditLogs.eventName, `%${eventName}%`));
    if (startDate)
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.createdAt, end));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt));
    const groupedLogs = groupAuditLogs(logs);
    const paginatedLogs = groupedLogs.slice(offset, offset + limit);

    return NextResponse.json({
      logs: paginatedLogs,
      total: groupedLogs.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Audit log fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
