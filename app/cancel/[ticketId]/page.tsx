import { redirect } from "next/navigation";
import { isValidUUID } from "@/app/lib/validation";
import { db, eq, tickets } from "@ssb/db";

interface PageProps {
  params: Promise<{ ticketId: string }>;
}

export default async function CancelTicketRedirect({ params }: PageProps) {
  const { ticketId } = await params;

  if (!isValidUUID(ticketId)) {
    redirect("/upcoming-speakers");
  }

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: { eventId: true },
    with: {
      event: {
        columns: { route: true },
      },
    },
  });

  if (!ticket) {
    redirect("/upcoming-speakers");
  }

  const route = ticket.event?.route;

  if (!route) {
    redirect("/upcoming-speakers");
  }

  redirect(`/events/${route}?cancel_ticket=${ticketId}`);
}
