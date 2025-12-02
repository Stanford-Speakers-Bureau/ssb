import { redirect } from "next/navigation";
import { getEventByRoute, isEventMystery } from "../lib/supabase";

interface PageProps {
  params: Promise<{ eventID: string }>;
}

export default async function EventRedirectPage({ params }: PageProps) {
  const { eventID } = await params;
  
  const event = await getEventByRoute(eventID);
  
  // If no event found with this route, redirect to home
  if (!event) {
    redirect("/");
  }
  
  // If the event is still a mystery, redirect to home
  if (isEventMystery(event)) {
    redirect("/");
  }
  
  // Event is revealed and route matches - redirect to the event page
  redirect(`/events/${event.route || eventID}`);
}

