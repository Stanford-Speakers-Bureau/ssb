import { connection } from "next/server";
import AdminEventQuestionsClient from "./AdminEventQuestionsClient";
import { getAdminEventQuestions } from "./data";

export const dynamic = "force-dynamic";

export default async function AdminEventQuestionsPage() {
  await connection();
  const { questions } = await getAdminEventQuestions();
  return <AdminEventQuestionsClient initialQuestions={questions} />;
}
