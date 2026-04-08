import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";
import { db, eq, and, referrals, events } from "@ssb/db";
import { generateReferralCode } from "@/app/lib/utils";
import { checkRateLimit, referralValidateRatelimit } from "@/app/lib/ratelimit";
import { validateReferralInput } from "@/app/lib/referrals";

/**
 * GET /api/referrals
 *
 * If User: Returns referral count for authenticated user.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || searchParams.get("event_id");

    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing required query parameter: event_id" },
        { status: 400 },
      );
    }

    const userReferralCode = generateReferralCode(user.email);
    if (!userReferralCode) {
      return NextResponse.json(
        { error: "Unable to generate referral code" },
        { status: 500 },
      );
    }

    const referral = await db.query.referrals.findFirst({
      where: and(eq(referrals.eventId, eventId), eq(referrals.referralCode, userReferralCode)),
      columns: { count: true },
    });

    return NextResponse.json({ count: referral?.count ?? 0 }, { status: 200 });
  } catch (error) {
    console.error("Referral API error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/referrals
 * Validates a referral code.
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const rateLimitResponse = await checkRateLimit(
      referralValidateRatelimit,
      `referral-validate:${user.email}`,
    );
    if (rateLimitResponse) return rateLimitResponse;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { referral_code, event_id } = body as {
      referral_code?: string;
      event_id?: string;
    };

    if (!referral_code || typeof referral_code !== "string") {
      return NextResponse.json(
        { error: "Missing required field: referral_code" },
        { status: 400 },
      );
    }

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json(
        { error: "Missing required field: event_id" },
        { status: 400 },
      );
    }

    const event = await db.query.events.findFirst({
      where: eq(events.id, event_id),
      columns: {
        id: true,
        referralsEnabled: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 },
      );
    }

    const validation = await validateReferralInput({
      eventId: event_id,
      referralCode: referral_code,
      userEmail: user.email,
      referralsEnabled: event.referralsEnabled,
      disabledBehavior: "reject",
    });

    if (!validation.ok) {
      return NextResponse.json(
        {
          valid: false,
          reason: validation.reason,
          message: validation.message,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (error) {
    console.error("Referral validation error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
