import { EventSync } from "@/app/EventSync";
import SummaryClient from "../SummaryClient";

export default async function SummaryEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <>
      <EventSync eventId={eventId} />
      <SummaryClient />
    </>
  );
}
