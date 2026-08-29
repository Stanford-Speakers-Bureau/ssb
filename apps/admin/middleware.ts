import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Maximum allowed request body size (1MB)
const MAX_CONTENT_LENGTH = 1024 * 1024;

// Routes that don't require origin validation (OAuth callbacks, etc.)
const ORIGIN_EXEMPT_ROUTES = [
  "/api/auth/login",
  "/api/auth/callback",
  "/api/auth/metadata",
];

/**
 * Get allowed origins for CSRF validation
 */
function getAllowedOrigins(request: NextRequest): string[] {
  const host = request.headers.get("host") || "";
  const isProduction = process.env.NODE_ENV === "production";

  const origins = host ? [`https://${host}`] : [];

  // Only allow localhost in development
  if (!isProduction) {
    origins.push(
      process.env.NEXT_PUBLIC_ROOT_URL ?? "http://localhost:3001",
      ...(host ? [`http://${host}`] : []),
    );
  }

  return origins;
}

function normalizeOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
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

  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedRequestOrigin) {
    return false;
  }

  const allowedOrigins = getAllowedOrigins(request);
  return allowedOrigins
    .map((allowed) => normalizeOrigin(allowed))
    .filter((allowed): allowed is string => Boolean(allowed))
    .includes(normalizedRequestOrigin);
}

/**
 * Middleware to enforce security policies on API routes and handle redirects
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip validation for non-mutating methods on API routes
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
    const isSamlCallback = pathname.startsWith("/api/auth/callback");

    if (
      !contentType?.includes("application/json") &&
      !contentType?.includes("multipart/form-data") &&
      !(isSamlCallback && contentType?.includes("application/x-www-form-urlencoded"))
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid content type. Expected application/json, multipart/form-data, or form-encoded SSO callback data",
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
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
