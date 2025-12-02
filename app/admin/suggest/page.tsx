import AdminSuggestClient, { Suggestion } from "./AdminSuggestClient";
import { getAdminSuggestions } from "./data";

export const dynamic = "force-dynamic";

export default async function AdminSuggestPage() {
  const { suggestions } = await getAdminSuggestions();
  return <AdminSuggestClient initialSuggestions={suggestions} />;
}
