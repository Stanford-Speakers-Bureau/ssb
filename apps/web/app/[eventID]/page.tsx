import { redirect, notFound } from "next/navigation";
import { getEventByRoute, isEventMystery } from "@/app/lib/supabase";

// Force dynamic rendering to avoid static generation issues on Cloudflare Workers
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ eventID: string }>;
}

export default async function EventRedirectPage({ params }: PageProps) {
  const { eventID } = await params;

  const event = await getEventByRoute(eventID);

  // If no event found or event is mystery, show 404
  if (!event || isEventMystery(event)) {
    notFound();
  }

  // Event is revealed and route matches - redirect to the event page
  redirect(`/events/${event.route || eventID}`);
}
