import AdminSuggestClient from "./AdminSuggestClient";
import { getAdminSuggestions } from "./data";
import { connection } from "next/server";

export const dynamic = "force-dynamic";

export default async function AdminSuggestPage() {
  await connection();
  const { suggestions } = await getAdminSuggestions();
  return <AdminSuggestClient initialSuggestions={suggestions} />;
}
