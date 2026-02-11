import type { MetadataRoute } from "next";
import { getSupabaseClient } from "@/app/lib/supabase";

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

  // Fetch published events with a route
  const supabase = getSupabaseClient();
  const { data: events } = await supabase
    .from("events")
    .select("route, name, release_date")
    .not("route", "is", null)
    .not("name", "is", null);

  const now = new Date().toISOString();

  const eventPages: MetadataRoute.Sitemap = (events || [])
    .filter((e) => {
      // Exclude mystery events (release_date in the future)
      if (e.release_date && e.release_date > now) return false;
      return true;
    })
    .map((e) => ({
      url: `${baseURL}/events/${e.route}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [...staticPages, ...eventPages];
}
