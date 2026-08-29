import { EventSync } from "@/app/EventSync";
import WaitlistViewerClient from "../WaitlistViewerClient";

export const dynamic = "force-dynamic";

export default async function WaitlistEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <>
      <EventSync eventId={eventId} />
      <WaitlistViewerClient />
    </>
  );
}
