import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Maximum allowed request body size (1MB)
const MAX_CONTENT_LENGTH = 1024 * 1024;

// Routes that don't require origin validation (OAuth callbacks, etc.)
const ORIGIN_EXEMPT_ROUTES = ["/api/auth/google"];

/**
 * Get allowed origins for CSRF validation
 */
function getAllowedOrigins(request: NextRequest): string[] {
  const host = request.headers.get("host") || "";
  const isProduction = process.env.NODE_ENV === "production";

  const origins = [`https://${host}`, `http://${host}`];

  // Only allow localhost in development
  if (!isProduction) {
    origins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  return origins;
}

/**
 * Validate request origin for CSRF protection
 */
function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // If no origin header, check referer (some browsers don't send origin)
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  // Allow requests without origin/referer (same-origin requests, curl, etc.)
  if (!requestOrigin) return true;

  const allowedOrigins = getAllowedOrigins(request);
  return allowedOrigins.some((allowed) =>
    requestOrigin.startsWith(allowed.replace(/\/$/, "")),
  );
}

/**
 * Proxy to enforce security policies on API routes
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip validation for non-mutating methods
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return NextResponse.next();
  }

  // CSRF Protection: Validate origin for state-changing requests
  const isExemptRoute = ORIGIN_EXEMPT_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  if (!isExemptRoute && !isValidOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  // Validate Content-Type for requests with body
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const contentType = request.headers.get("content-type");

    if (
      !contentType?.includes("application/json") &&
      !contentType?.includes("multipart/form-data")
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid content type. Expected application/json or multipart/form-data",
        },
        { status: 400 },
      );
    }

    // Check Content-Length to prevent oversized payloads
    const contentLength = request.headers.get("content-length");
    // 10MB limit for file uploads
    const MAX_SIZE = contentType?.includes("multipart/form-data")
      ? 10 * 1024 * 1024
      : MAX_CONTENT_LENGTH;

    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
