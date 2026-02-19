import type { MetadataRoute } from "next";
import { db, events, and, isNotNull } from "@ssb/db";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseURL}/`, changeFrequency: "weekly", priority: 1 },
    {
      url: `${baseURL}/upcoming-speakers`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseURL}/past-speakers`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    { url: `${baseURL}/team`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseURL}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseURL}/suggest`, changeFrequency: "weekly", priority: 0.6 },
    {
      url: `${baseURL}/event-sponsorship`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    { url: `${baseURL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseURL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const now = new Date();

  const allEvents = await db.query.events.findMany({
    where: and(isNotNull(events.route), isNotNull(events.name)),
    columns: { route: true, releaseDate: true },
  });

  const eventPages: MetadataRoute.Sitemap = allEvents
    .filter((e) => {
      if (e.releaseDate && e.releaseDate > now) return false;
      return true;
    })
    .map((e) => ({
      url: `${baseURL}/events/${e.route}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [...staticPages, ...eventPages];
}
