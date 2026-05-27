import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({
    authenticated: !!user,
    // The PostHog distinct_id the server uses (see posthog-server captures).
    // Returned only to the authenticated user themselves so the client can
    // adopt the same identity and merge client + server events.
    distinctId: user?.email ?? null,
  });
}
