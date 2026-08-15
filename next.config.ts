import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev({
    // E2E runs must be hermetic. A `remote: true` R2 binding otherwise opens
    // a Cloudflare edge-preview session during `next dev`.
    remoteBindings: process.env.E2E_TESTS !== "true",
  });
}

const nextConfig: NextConfig = {
  transpilePackages: ["@ssb/db"],
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  images: {
    qualities: [70, 75, 90],
    loader: "custom",
    loaderFile: "./image-loader.ts",
  },
  // PostHog ingestion is reverse-proxied in middleware (with the Cookie header
  // stripped to avoid 431 errors), not via rewrites here — see middleware.ts.
  async redirects() {
    return [
      {
        source: "/our-team",
        destination: "/team",
        permanent: true,
      },
      {
        source: "/past-events",
        destination: "/past-speakers",
        permanent: true,
      },
      {
        source: "/co-sponsorships-partnerships",
        destination: "/event-sponsorship",
        permanent: true,
      },
      {
        source: "/other-programs",
        destination: "/event-sponsorship",
        permanent: true,
      },
      {
        source: "/i/thm",
        destination:
          "https://drive.google.com/file/d/1OxdUEGHx31u_lwL6vM_ajsJjleQZgphm/view?usp=sharing",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.googleusercontent.com https://*.supabase.co",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com",
              // PostHog session replay compresses snapshots in a blob web worker.
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
