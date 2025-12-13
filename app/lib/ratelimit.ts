import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Initialize Redis client from environment variables
const redis = Redis.fromEnv();

/**
 * Rate limiter for suggestion submissions
 * 10 suggestions per minute per user
 */
export const suggestRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "ratelimit:suggest",
  analytics: true,
});

/**
 * Rate limiter for voting
 * 30 votes per minute per user
 */
export const voteRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  prefix: "ratelimit:vote",
  analytics: true,
});

/**
 * Rate limiter for notifications
 * 3 notification signups per minute per user
 */
export const notifyRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "60 s"),
  prefix: "ratelimit:notify",
  analytics: true,
});

/**
 * Rate limiter for tickets
 * 10 ticket operations per minute per user
 */
export const ticketRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "ratelimit:ticket",
  analytics: true,
});

/**
 * Check rate limit and return error response if exceeded
 * Returns null if rate limit is OK, or a NextResponse if rate limited
 */
export async function checkRateLimit(
  ratelimit: Ratelimit,
  identifier: string,
): Promise<NextResponse | null> {
  const { success, limit, reset, remaining } =
    await ratelimit.limit(identifier);

  if (!success) {
    return NextResponse.json(
      {
        error: "Too many requests. Try again later.",
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      },
    );
  }

  return null;
}
