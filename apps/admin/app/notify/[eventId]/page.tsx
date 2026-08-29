import { EventSync } from "@/app/EventSync";
import AdminNotifyClient from "../AdminNotifyClient";

export const dynamic = "force-dynamic";

export default async function NotifyEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <>
      <EventSync eventId={eventId} />
      <AdminNotifyClient />
    </>
  );
}
