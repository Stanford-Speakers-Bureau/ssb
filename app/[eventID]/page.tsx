import { redirect } from "next/navigation";
import { getSupabaseClient, type Event } from "../lib/supabase";

type EventWithRoute = Event & {
  route: string | null;
};

async function getEventByRoute(eventID: string): Promise<EventWithRoute | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("route", eventID)
    .single();

  if (error || !data) {
    return null;
  }

  return data as EventWithRoute;
}

function isEventMystery(event: EventWithRoute): boolean {
  const now = new Date();
  const releaseDate = event.release_date ? new Date(event.release_date) : null;
  return releaseDate ? now < releaseDate : !event.name;
}

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

