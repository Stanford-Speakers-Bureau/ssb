import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [70, 75, 90],
    loader: "custom",
    loaderFile: "./image-loader.ts",
  },
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
              "connect-src 'self' https://*.supabase.co",
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
