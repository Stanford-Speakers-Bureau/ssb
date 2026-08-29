import { EventSync } from "@/app/EventSync";
import NotifyAnalyticsClient from "../NotifyAnalyticsClient";

export default async function NotifyAnalyticsEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <>
      <EventSync eventId={eventId} />
      <NotifyAnalyticsClient />
    </>
  );
}
