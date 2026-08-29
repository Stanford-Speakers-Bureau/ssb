import { EventSync } from "@/app/EventSync";
import ReferralLeaderboardClient from "../ReferralLeaderboardClient";

export const dynamic = "force-dynamic";

export default async function ReferralsEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <>
      <EventSync eventId={eventId} />
      <ReferralLeaderboardClient />
    </>
  );
}
