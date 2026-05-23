import { NextRequest, NextResponse } from "next/server";

// POST /v1/log — devices report web-service errors here. Log and ack.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { logs?: string[] };
    if (Array.isArray(body?.logs) && body.logs.length > 0) {
      console.warn("[wallet] device logs:", body.logs.join(" | "));
    }
  } catch {
    // ignore malformed bodies — this endpoint is best-effort
  }
  return new NextResponse(null, { status: 200 });
}
