import type { MetadataRoute } from "next";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account", "/scan", "/google-oauth"],
      },
    ],
    sitemap: `${baseURL}/sitemap.xml`,
  };
}
