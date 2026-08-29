import { EventSync } from "@/app/EventSync";
import AudienceClient from "../AudienceClient";

export default async function AudienceEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <>
      <EventSync eventId={eventId} />
      <AudienceClient />
    </>
  );
}
