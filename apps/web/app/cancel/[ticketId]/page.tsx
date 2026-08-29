import { redirect } from "next/navigation";
import { verifyCancellationToken } from "@/app/lib/cancellation-links";
import { isValidUUID } from "@/app/lib/validation";
import { db, eq, tickets } from "@ssb/db";

interface PageProps {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ cancel_token?: string | string[] | undefined }>;
}

export default async function CancelTicketRedirect({
  params,
  searchParams,
}: PageProps) {
  const { ticketId } = await params;
  const { cancel_token: cancelTokenParam } = await searchParams;
  const cancelToken =
    typeof cancelTokenParam === "string" ? cancelTokenParam : null;

  if (!isValidUUID(ticketId)) {
    redirect("/upcoming-speakers");
  }

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: { eventId: true, email: true },
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

  const redirectParams = new URLSearchParams({ cancel_ticket: ticketId });
  const verifiedToken = cancelToken
    ? await verifyCancellationToken(cancelToken)
    : null;
  const normalizedTicketEmail = ticket.email.trim().toLowerCase();

  if (
    cancelToken &&
    verifiedToken &&
    verifiedToken.ticketId === ticketId &&
    verifiedToken.email === normalizedTicketEmail
  ) {
    redirectParams.set("cancel_token", cancelToken);
  }

  redirect(`/events/${route}?${redirectParams.toString()}`);
}
