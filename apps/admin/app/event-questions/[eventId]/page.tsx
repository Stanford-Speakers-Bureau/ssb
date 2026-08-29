import { connection } from "next/server";
import { EventSync } from "@/app/EventSync";
import AdminEventQuestionsClient from "../AdminEventQuestionsClient";
import { getAdminEventQuestions } from "../data";

export const dynamic = "force-dynamic";

export default async function AdminEventQuestionsEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  await connection();
  const { eventId } = await params;
  const { questions } = await getAdminEventQuestions();
  return (
    <>
      <EventSync eventId={eventId} />
      <AdminEventQuestionsClient initialQuestions={questions} />
    </>
  );
}
