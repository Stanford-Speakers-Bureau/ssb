import type { MetadataRoute } from "next";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Allow the image proxy so link-unfurlers (Slack, etc.) can fetch og:image,
        // which lives under /api/. More specific Allow takes precedence over Disallow.
        allow: ["/", "/api/images/"],
        disallow: ["/api/", "/account", "/scan"],
      },
    ],
    sitemap: `${baseURL}/sitemap.xml`,
  };
}
