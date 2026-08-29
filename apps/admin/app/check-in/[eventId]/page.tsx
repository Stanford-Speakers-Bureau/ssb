import { EventSync } from "@/app/EventSync";
import CheckInClient from "../CheckInClient";

export default async function CheckInEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <>
      <EventSync eventId={eventId} />
      <CheckInClient />
    </>
  );
}
