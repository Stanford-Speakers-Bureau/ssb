import AdminUsersClient, { Admin, Ban } from "./AdminUsersClient";

export const dynamic = "force-dynamic";

async function getInitialUsers(): Promise<{ admins: Admin[]; bans: Ban[] }> {
  try {
    // Use a relative URL so that admin auth cookies are forwarded to the API route.
    const response = await fetch(`/api/admin/users`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Failed to fetch initial users:", data.error || data);
      return { admins: [], bans: [] };
    }
    return {
      admins: data.admins || [],
      bans: data.bans || [],
    };
  } catch (error) {
    console.error("Failed to fetch initial users:", error);
    return { admins: [], bans: [] };
  }
}

export default async function AdminUsersPage() {
  const { admins, bans } = await getInitialUsers();
  return <AdminUsersClient initialAdmins={admins} initialBans={bans} />;
}

