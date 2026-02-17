import { redirect } from "next/navigation";
import { getSupabaseClient } from "@/app/lib/supabase";
import { isValidUUID } from "@/app/lib/validation";

interface PageProps {
  params: Promise<{ ticketId: string }>;
}

export default async function CancelTicketRedirect({ params }: PageProps) {
  const { ticketId } = await params;

  if (!isValidUUID(ticketId)) {
    redirect("/upcoming-speakers");
  }

  const supabase = getSupabaseClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      `
      event_id,
      events (
        route
      )
    `,
    )
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    redirect("/upcoming-speakers");
  }

  const event = Array.isArray(ticket.events)
    ? ticket.events[0]
    : ticket.events;
  const route = event?.route;

  if (!route) {
    redirect("/upcoming-speakers");
  }

  redirect(`/events/${route}?cancel_ticket=${ticketId}`);
}
