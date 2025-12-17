import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseClient } from "./app/lib/supabase";

export const runtime = "experimental-edge";

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

  const origins = [`https://${host}`];

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
 * Check if user has scanner role and redirect to /scan if event is live
 */
async function handleScannerRedirect(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip redirect logic if already on /scan, /api, or /admin routes
  if (pathname.startsWith("/scan") || pathname.startsWith("/admin")) {
    return null;
  }

  try {
    // Check if there's a live event
    const adminClient = getSupabaseClient();
    const { data: liveEvent } = await adminClient
      .from("events")
      .select("id")
      .eq("live", true)
      .single();

    // If no live event, continue normally
    if (!liveEvent) {
      return null;
    }

    // Check if user has scanner role
    let response = NextResponse.next();
    const supabase = createServerClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll().map((cookie) => ({
              name: cookie.name,
              value: cookie.value,
            }));
          },
          setAll(cookiesToSet) {
            response = NextResponse.next();
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // If not authenticated, continue normally
    if (!user?.email) {
      return null;
    }

    // Check if user has scanner role
    const { data: scannerRecord } = await adminClient
      .from("roles")
      .select("roles")
      .eq("email", user.email)
      .single();

    const hasScannerRole =
      scannerRecord?.roles?.split(",").includes("scanner") || false;

    // If user has scanner role and there's a live event, redirect to /scan
    if (hasScannerRole) {
      return NextResponse.redirect(new URL("/scan", request.url));
    }
  } catch (error) {
    // If any error occurs, continue normally
    console.error("Scanner redirect error:", error);
  }

  return null;
}

/**
 * Proxy to enforce security policies on API routes and handle redirects
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Handle scanner redirect for non-API routes
  if (!pathname.startsWith("/api")) {
    const redirectResponse = await handleScannerRedirect(request);
    if (redirectResponse) {
      return redirectResponse;
    }
  }

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
