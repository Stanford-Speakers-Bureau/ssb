import { EventSync } from "@/app/EventSync";
import FeedbackAnalyticsClient from "../FeedbackAnalyticsClient";

export default async function FeedbackAnalyticsEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <>
      <EventSync eventId={eventId} />
      <FeedbackAnalyticsClient />
    </>
  );
}
