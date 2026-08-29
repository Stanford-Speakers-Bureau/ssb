import { EventSync } from "@/app/EventSync";
import SalesClient from "../SalesClient";

export default async function SalesEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <>
      <EventSync eventId={eventId} />
      <SalesClient />
    </>
  );
}
