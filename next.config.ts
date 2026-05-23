import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  transpilePackages: ["@ssb/db"],
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
      {
        source: "/i/thm",
        destination: "https://drive.google.com/file/d/1OxdUEGHx31u_lwL6vM_ajsJjleQZgphm/view?usp=sharing",
        permanent: false,
      },
    ];
  },
  async headers() {
    // Dev-only: allow the ui.sh theme picker to load its script/assets.
    // In production `uish` is empty, so the CSP is byte-identical to before.
    const uish = process.env.NODE_ENV === "production" ? "" : " https://ui.sh";
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
              `script-src 'self' 'unsafe-inline' 'unsafe-eval'${uish}`,
              `style-src 'self' 'unsafe-inline'${uish}`,
              `img-src 'self' data: blob: https://*.googleusercontent.com https://*.supabase.co${uish}`,
              `font-src 'self' data:${uish}`,
              `connect-src 'self' https://*.supabase.co${uish}`,
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
