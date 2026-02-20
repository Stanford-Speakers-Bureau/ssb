import type { Metadata } from "next";
import { redirect } from "next/navigation";
<<<<<<< Updated upstream
import { db, eq, and, events, sql, isNotNull } from "@ssb/db";
=======
>>>>>>> Stashed changes
import HomeClient from "./HomeClient";
import { createServerSupabaseClient } from "./lib/supabase";
import { db, eq, events } from "@ssb/db";

export const metadata: Metadata = {
  title: { absolute: "Stanford Speakers Bureau" },
  description:
    "Stanford Speakers Bureau (SSB) is Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.",
};

export default async function Home() {
<<<<<<< Updated upstream
  try {
    const result = await db
      .select({ route: events.route })
      .from(events)
      .where(
        and(
          eq(events.live, true),
          isNotNull(events.route),
          sql`(${events.startTimeDate} AT TIME ZONE 'America/Los_Angeles')::date
              = (NOW() AT TIME ZONE 'America/Los_Angeles')::date`,
          sql`NOW() < ${events.startTimeDate} + INTERVAL '2 hours'`
        )
      )
      .limit(1);

    const route = result[0]?.route;
    if (route) {
      redirect(`/events/${route}`);
    }
  } catch {
    // DB error — fail open, render home page normally
=======
  const liveEvent = await db.query.events.findFirst({
    where: eq(events.live, true),
    columns: { route: true, id: true },
  });

  if (liveEvent) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect(`/events/${liveEvent.route ?? liveEvent.id}`);
    }
>>>>>>> Stashed changes
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Stanford Speakers Bureau",
            alternateName: "SSB",
            url: process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com",
            logo: `${process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com"}/logo.png`,
            foundingDate: "1935",
            parentOrganization: {
              "@type": "CollegeOrUniversity",
              name: "Stanford University",
            },
          }),
        }}
      />
      <HomeClient />
    </>
  );
}
