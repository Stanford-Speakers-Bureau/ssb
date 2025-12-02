import AdminSuggestClient, { Suggestion } from "./AdminSuggestClient";

export const dynamic = "force-dynamic";

async function getInitialData(): Promise<{ suggestions: Suggestion[] }> {
  try {
    // Use a relative URL so Next.js forwards the user's cookies to the API route.
    // This ensures Supabase sees the authenticated admin session on the server.
    const response = await fetch(`/api/admin/suggestions?filter=pending`, {
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status !== 401) {
        console.error("Failed to fetch initial suggestions:", await response.text());
      }
      return { suggestions: [] };
    }
    const data = await response.json();
    return {
      suggestions: data.suggestions || [],
    };
  } catch (error) {
    console.error("Failed to fetch initial suggestions:", error);
    return { suggestions: [] };
  }
}

export default async function AdminSuggestPage() {
  const { suggestions } = await getInitialData();
  return <AdminSuggestClient initialSuggestions={suggestions} />;
}

